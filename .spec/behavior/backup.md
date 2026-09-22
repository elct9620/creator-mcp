# Backup

What a deployment keeps for itself. A model stores what it generated and
answers with a link that stands for about a day; a deployment that wants the
file to outlive that sets `BACKUP` to `yes`, and a copy is written into its own
bucket while the reply goes on carrying the model's link unchanged. Anything
else, an unset secret included, leaves the copying off.

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

A deployment that keeps no copies takes the name all the same and does nothing
with it. What a tool offers should not turn on a secret the caller cannot see,
or the same client would find the same server different from one deployment to
the next.

The encoding a copy is named for is the one the reply states, read from the
store the same way it is when no copy is kept. Taking it from the copy's own
answer would save asking twice, at the cost of two paths deciding what a file
is; a name and a reply that could disagree costs more than the request does.

A caller has paid for the generation before any of this runs, so nothing here
may take that away from them: a copy that cannot be made leaves the reply
exactly as it would have been, and says so in the log with its reason rather
than to the caller, because a deployment getting no copies has nothing else to
go on. Three things make one impossible: a caller Access resolved no address
for; a source that will not say how long it is, since a stream can only be
written when its length is known ahead of it and finding that out by reading
the file in whole is what this Worker declines to do; and a bucket that
refuses the write.

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

## `B-003` What a backup does not change

| Step  | Statement                                                       |
| ----- | --------------------------------------------------------------- |
| Given | a deployment with `BACKUP` set to `yes`                         |
| When  | a file is generated                                             |
| Then  | the reply carries the model's own link, as it would without one |

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

| Step  | Statement                                      |
| ----- | ---------------------------------------------- |
| Given | a bucket that refuses the write                |
| When  | a file is generated                            |
| Then  | the reply is the one the caller would have had |

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

| Step | Statement                                        |
| ---- | ------------------------------------------------ |
| When | a client lists what the server offers            |
| Then | each tool's schema states what a `name` may hold |
