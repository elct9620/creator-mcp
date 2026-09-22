/**
 * The copy a deployment keeps of what a model generated, so the file outlives
 * the day the model's own link stands for. The caller has already paid for the
 * generation by the time any of this runs, so nothing here may cost them it: a
 * copy that cannot be made is said in the log and never to them.
 */

/** The one value that turns the copying on. Anything else leaves it off. */
const ON = 'yes';

const UTC = 'UTC';

// A bucket whose root fills with files of no stated kind cannot later say what
// else it holds, so nothing is written outside this.
const PREFIX = 'backup';

/** Eight bytes of the digest, which is what names a caller without telling who they are. */
const USER_LENGTH = 16;

const LENGTH = 'content-length';
const TYPE = 'content-type';

/** Keeps a copy of what the link holds. It never rejects, and never delays the reply's content. */
export type Backup = (link: string, extension?: string) => Promise<void>;

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
const pathFor = async (email: string, zone: string | undefined, extension?: string) => {
	const { day, time } = momentIn(zoneOf(zone));
	const name = `${time}-${crypto.randomUUID().slice(0, 4)}`;

	return `${PREFIX}/${await userOf(email)}/${day}/${extension ? `${name}.${extension}` : name}`;
};

const keep = async (
	{ BUCKET, TZ }: Env,
	access: CloudflareAccessContext | undefined,
	link: string,
	extension: string | undefined,
): Promise<void> => {
	const email = (await access?.getIdentity())?.email;
	if (!email) {
		console.warn('Backup is on, but Access resolved no address for this caller. Nothing was kept.');

		return;
	}

	const source = await fetch(link);
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

	await BUCKET.put(await pathFor(email, TZ, extension), source.body, {
		httpMetadata: { contentType: source.headers.get(TYPE) ?? undefined },
	});
};

/**
 * What this deployment does about keeping copies, decided once per request:
 * a `Backup` when it asked for them, and nothing at all when it did not, so a
 * tool serving a deployment that keeps none holds nothing that could.
 */
export const backupFor = (env: Env, access: CloudflareAccessContext | undefined): Backup | undefined =>
	env.BACKUP === ON
		? async (link, extension) => {
				try {
					await keep(env, access, link, extension);
				} catch (error) {
					console.error('Backup is on, but the copy could not be kept.', error);
				}
			}
		: undefined;
