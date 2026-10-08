# Backup

What a deployment keeps for itself. A model stores what it generated and
answers with a link that stands for about a day, or hands the file over in the
answer itself and keeps nothing; a deployment that wants the file to outlive
either sets `BACKUP` to `yes`, and a copy is written into its own bucket.
Anything else, an unset secret included, leaves the copying off.

The reply then links to the copy rather than to the model's own store. A file
handed over in the answer has no link of its own, and a client that cannot
show it leaves the person nothing to fetch; a link in text is the one form
every client passes on, so the copy is what gives every file one. Its link is
presigned through R2's S3 API with credentials of the deployment's own, since
the bucket binding reads and writes but cannot sign, and it stands for a day,
as the model's own link does, so a caller's sense of how long they have does
not turn on which of the two they were handed.

Signing needs the bucket's name, and nothing in the repository can state it:
the bucket a deploy creates is named after the Worker as the dashboard names
it, which a fork need not share, and the binding cannot say at runtime which
bucket it is. So the deployment states it, beside the credentials, in
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and
`R2_BUCKET_NAME`. A deployment that asks for copies without all four leaves
the copying off, because a copy it could not link to would hand a caller a link
that fails only once they follow it, and the log names the ones missing, since
the deployment has nothing else to go on.

Who a copy belongs to comes from Cloudflare Access, which resolved the caller
before the request arrived. The path is `backup/{user}/{date}/{name}`, and each
part is there for a reason: `backup/` because a bucket whose root fills with
files of no stated kind cannot later say what else it holds; `{user}` as the
first sixteen hex digits of the SHA-256 of the caller's email address, which
stays the same for as long as that address does and tells a reader nothing
about whose it is; and `{date}` read in the zone `TZ` names, because a folder
a person browses should break where their day breaks. A name is the time of
day and four random characters, so that two files made in the same second are
two files, and then whatever the caller called it.

A caller names a file with `name`, which is the only part of the path they
have any say over. It is the last part of a key, so a slash in it would put
the file somewhere they did not ask for; that, a control character, and a name
longer than a name refuse the call before the model is asked, because a
generation is paid for the moment it is made and a refusal afterwards would
charge for nothing. The rule rides in the tool's own schema, so a caller can
read it rather than discover it.

A deployment that keeps no copies does not offer `name` at all. A tool that
takes an argument and does nothing with it tells a caller something untrue, and
that costs more than a client finding one deployment's tools different from
another's: what a tool offers is what this deployment can do.

The encoding a copy is named for is the one the reply states, read from the
store the same way it is when no copy is kept — or, for a file handed over in
the answer, the one the answer states. Taking it from the copy's own
answer would save asking twice, at the cost of two paths deciding what a file
is; a name and a reply that could disagree costs more than the request does.

A caller has paid for the generation before any of this runs, so nothing here
may take that away from them: a copy that cannot be made leaves the model's own
link in the reply, and the reason goes to the log rather than to the caller,
because a deployment getting no copies has nothing else to go on. Three things
make one impossible: a caller Access resolved no address for; a source that
will not say how long it is, since a stream can only be written when its
length is known ahead of it and finding that out by reading the file in whole
is what this Worker declines to do; and a bucket that refuses the write. A
file handed over in the answer is already in hand with its length known, so
the second of these never applies to it — but it has no link of its own to
fall back on, so for it the call fails instead, telling the caller the file
could not be kept to link to.

## Includes

- `test/backup.spec.ts`

## `B-001` A deployment that asked for no backups

| Step  | Statement                        |
| ----- | -------------------------------- |
| Given | a deployment with `BACKUP` unset |
| When  | a file is generated              |
| Then  | nothing is written to the bucket |

## `B-002` A deployment that asked for backups

| Step  | Statement                                                |
| ----- | -------------------------------------------------------- |
| Given | a deployment with `BACKUP` set to `yes`                  |
| When  | a file is generated                                      |
| Then  | a copy of it is written at `backup/{user}/{date}/{name}` |

## `B-003` The link a backup hands on

| Step  | Statement                                                  |
| ----- | ---------------------------------------------------------- |
| Given | a deployment with `BACKUP` set to `yes`                    |
| When  | a file is generated                                        |
| Then  | the reply links to the copy rather than to the model's own |

## `B-004` The zone a day is read in

| Step  | Statement                                |
| ----- | ---------------------------------------- |
| Given | a deployment naming a zone in `TZ`       |
| When  | a file is generated                      |
| Then  | the date in the path is that zone's date |

## `B-005` A deployment naming no zone

| Step  | Statement                          |
| ----- | ---------------------------------- |
| Given | a deployment with `TZ` unset       |
| When  | a file is generated                |
| Then  | the date in the path is UTC's date |

## `B-006` A zone that is not one

| Step  | Statement                                      |
| ----- | ---------------------------------------------- |
| Given | a deployment naming a zone that does not exist |
| When  | a file is generated                            |
| Then  | the date in the path is UTC's date             |

## `B-007` A caller with no address

| Step  | Statement                                     |
| ----- | --------------------------------------------- |
| Given | a caller Access resolved no email address for |
| When  | a file is generated                           |
| Then  | nothing is written to the bucket              |

## `B-008` A source that will not say how long it is

| Step  | Statement                                              |
| ----- | ------------------------------------------------------ |
| Given | a store answering without a length                     |
| When  | a file is generated                                    |
| Then  | nothing is written to the bucket, and the log says why |

## `B-009` A backup that cannot be made

| Step  | Statement                              |
| ----- | -------------------------------------- |
| Given | a bucket that refuses the write        |
| When  | a file is generated                    |
| Then  | the reply carries the model's own link |

## `B-010` A caller who named the file

| Step  | Statement                                        |
| ----- | ------------------------------------------------ |
| Given | a caller naming the file in `name`               |
| When  | a file is generated                              |
| Then  | the name is the last part of the copy's own name |

## `B-011` A name that cannot be part of a path

| Step  | Statement                                     |
| ----- | --------------------------------------------- |
| Given | a name holding a slash or a control character |
| When  | a file is asked for                           |
| Then  | the call is refused before the model is asked |

## `B-012` The rule a caller can read

| Step  | Statement                                        |
| ----- | ------------------------------------------------ |
| Given | a deployment keeping copies                      |
| When  | a client lists what the server offers            |
| Then  | each tool's schema states what a `name` may hold |

## `B-013` A file handed over in the answer

| Step  | Statement                                                                           |
| ----- | ----------------------------------------------------------------------------------- |
| Given | a deployment with `BACKUP` set to `yes`, and a model answering with the file itself |
| When  | the file is generated                                                               |
| Then  | a copy of it is written at `backup/{user}/{date}/{name}`                            |

## `B-014` How long the copy's link stands

| Step  | Statement                                   |
| ----- | ------------------------------------------- |
| Given | a deployment with `BACKUP` set to `yes`     |
| When  | a file is generated                         |
| Then  | the link to the copy is presigned for a day |

## `B-015` A deployment that cannot sign a link

| Step  | Statement                                                                                                 |
| ----- | --------------------------------------------------------------------------------------------------------- |
| Given | a deployment with `BACKUP` set to `yes` but any of the four signing secrets unset                         |
| When  | a file is generated                                                                                       |
| Then  | nothing is written to the bucket, the reply carries the model's own link, and the log names what is unset |

## `B-016` A deployment that keeps no copies offers no name

| Step  | Statement                             |
| ----- | ------------------------------------- |
| Given | a deployment keeping no copies        |
| When  | a client lists what the server offers |
| Then  | neither tool's schema offers a `name` |
