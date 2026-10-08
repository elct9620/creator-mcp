/**
 * The copy a deployment keeps of what a model generated, so the file outlives
 * the day the model's own link stands for, and the link a caller is handed to
 * it. The caller has already paid for the generation by the time any of this
 * runs, so nothing here may cost them it: a copy that cannot be made is said in
 * the log and never to them.
 */

import { AwsClient } from 'aws4fetch';
import { z } from 'zod';
import type { Carried } from './stored';

/** The one value that turns the copying on. Anything else leaves it off. */
const ON = 'yes';

const UTC = 'UTC';

// A bucket whose root fills with files of no stated kind cannot later say what
// else it holds, so nothing is written outside this.
const PREFIX = 'backup';

/** As long as the model's own link stands, so which of the two a caller holds does not change how long they have. */
const LINK_SECONDS = 24 * 60 * 60;

/** Eight bytes of the digest, which is what names a caller without telling who they are. */
const USER_LENGTH = 16;

const LENGTH = 'content-length';
const TYPE = 'content-type';

/** Long enough to name a file, short enough that a key stays a key. */
const NAME_LENGTH = 64;

/**
 * What a caller may call a file, which is the only part of a path they have
 * any say over. It is the last part of a key, so a slash would put the file
 * somewhere they did not ask for; the rule is stated in the schema rather than
 * enforced after the fact, because a generation is paid for the moment it is
 * made.
 */
export const nameAsked = z
	.string()
	.min(1)
	.max(NAME_LENGTH, `A name can be at most ${NAME_LENGTH} characters. Shorten it, or leave \`name\` off.`)
	.regex(/^[^/\u0000-\u001f\u007f]+$/, 'A name becomes the last part of a path, so it cannot hold a slash or a control character.')
	.optional()
	.describe('What to call this file where the deployment keeps copies of what it generates. No slashes.');

/** What the caller said about the file, in the words the path is built from. */
export type Called = { extension?: string; name?: string };

/** Keeps a copy of what the link holds, or of the file handed over, and answers with a link to it — or with nothing when none was kept. It never rejects. */
export type Backup = (source: string | Carried, called: Called) => Promise<string | undefined>;

/** What signs a link to a copy. The binding reads and writes but cannot sign, so this goes through R2's S3 API. */
type Signing = { accountId: string; bucket: string; client: AwsClient };

/**
 * What the deployment stated for signing, or nothing when any of it is
 * missing. The bucket's name is among it because nothing else can say it: a
 * deploy names the bucket after the Worker as the dashboard names it, and the
 * binding does not tell.
 */
const SIGNING_SECRETS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'] as const;

const signingOf = ({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME }: Env): Signing | undefined =>
	R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME
		? {
				accountId: R2_ACCOUNT_ID,
				bucket: R2_BUCKET_NAME,
				// R2 ignores both, and the signature needs them stated.
				// https://developers.cloudflare.com/r2/examples/aws/aws4fetch/
				client: new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' }),
			}
		: undefined;

const linkTo = async ({ accountId, bucket, client }: Signing, path: string) => {
	// Each part of the path is the caller's to name, and a `?` or `#` left as
	// it is would end the path the link is signed for.
	const key = path.split('/').map(encodeURIComponent).join('/');
	const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`);
	url.searchParams.set('X-Amz-Expires', String(LINK_SECONDS));

	return (await client.sign(new Request(url), { aws: { signQuery: true } })).url;
};

const userOf = async (email: string) => {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));

	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
		.slice(0, USER_LENGTH);
};

/**
 * The zone a day is read in. The runtime keeps UTC whatever a deployment says,
 * so a zone that was never named, or named as something that is not a zone,
 * lands back on the one the runtime already has.
 */
const zoneOf = (named: string | undefined) => {
	const zone = named || UTC;

	try {
		new Intl.DateTimeFormat('en-CA', { timeZone: zone });

		return zone;
	} catch {
		return UTC;
	}
};

/** Now, as the caller's day and the moment within it. */
const momentIn = (zone: string) => {
	const part = Object.fromEntries(
		new Intl.DateTimeFormat('en-CA', {
			timeZone: zone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23',
		})
			.formatToParts(new Date())
			.map(({ type, value }) => [type, value]),
	);

	return { day: `${part.year}-${part.month}-${part.day}`, time: `${part.hour}${part.minute}${part.second}` };
};

/**
 * Where a copy goes: `backup/{user}/{date}/{name}`. The date is the caller's
 * day rather than the runtime's, because a folder a person browses should
 * break where their day breaks. The name is the time of day and four random
 * characters, so two files made in the same second are two files.
 */
const pathFor = async (email: string, zone: string | undefined, { extension, name }: Called) => {
	const { day, time } = momentIn(zoneOf(zone));
	const called = `${time}-${crypto.randomUUID().slice(0, 4)}${name ? `-${name}` : ''}${extension ? `.${extension}` : ''}`;

	return `${PREFIX}/${await userOf(email)}/${day}/${called}`;
};

/** Writes the copy, and answers with where it went or with nothing when it could not be kept. */
const keep = async (
	{ BUCKET, TZ }: Env,
	access: CloudflareAccessContext | undefined,
	from: string | Carried,
	called: Called,
): Promise<string | undefined> => {
	const email = (await access?.getIdentity())?.email;
	if (!email) {
		console.warn('Backup is on, but Access resolved no address for this caller. Nothing was kept.');

		return;
	}

	if (typeof from !== 'string') {
		const path = await pathFor(email, TZ, called);
		await BUCKET.put(
			path,
			Uint8Array.from(atob(from.data), (char) => char.charCodeAt(0)),
			{
				httpMetadata: { contentType: from.mimeType },
			},
		);

		return path;
	}

	const source = await fetch(from);
	if (!source.ok || !source.body) {
		console.warn(`Backup is on, but the store answered ${source.status}. Nothing was kept.`);
		await source.body?.cancel();

		return;
	}

	// The file has to reach the bucket as a stream, and a stream can only be
	// written when its length is known ahead of it. Reading the file in whole
	// to find that out is the one thing this Worker will not do.
	if (!source.headers.has(LENGTH)) {
		console.warn('Backup is on, but the store did not say how long the file is. Nothing was kept.');
		await source.body.cancel();

		return;
	}

	// The length the store stated is what the stream is written as, rather
	// than whatever the runtime happens to track for the body it was handed.
	const path = await pathFor(email, TZ, called);
	const sized = new FixedLengthStream(Number(source.headers.get(LENGTH)));
	await Promise.all([
		source.body.pipeTo(sized.writable),
		BUCKET.put(path, sized.readable, {
			httpMetadata: { contentType: source.headers.get(TYPE) ?? undefined },
		}),
	]);

	return path;
};

/**
 * What this deployment does about keeping copies, decided once per request:
 * a `Backup` when it asked for them and stated how to link to them, and
 * nothing at all otherwise, so a tool serving a deployment that keeps none
 * holds nothing that could. A copy nobody can be linked to would hand a caller
 * a link that fails only once they follow it, so asking without the signing
 * secrets is the same as not asking.
 */
export const backupFor = (env: Env, access: CloudflareAccessContext | undefined): Backup | undefined => {
	if (env.BACKUP !== ON) return undefined;

	const signing = signingOf(env);
	if (!signing) {
		const missing = SIGNING_SECRETS.filter((secret) => !env[secret]);
		console.warn(`Backup is on, but ${missing.join(', ')} is unset, so no copy could be linked to. Nothing is kept.`);

		return undefined;
	}

	return async (source, called) => {
		try {
			const path = await keep(env, access, source, called);

			return path && (await linkTo(signing, path));
		} catch (error) {
			console.error('Backup is on, but the copy could not be kept.', error);
		}
	};
};
