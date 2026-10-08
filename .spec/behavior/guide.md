# Guides

The tool this application offers for reading how to use the others beyond what
their own descriptions say.

A tool's description is one string, read every time the tools are listed, so
it holds what every call needs and nothing more. Some of what a caller can do
is longer than that and matters only now and then — how to steer the way a
model speaks, say — and a description carrying it would be long for every call
to pay for one. That knowledge is kept as guides instead, each read only when
it is wanted, the way an agent skill is: a name and one line saying what it is
for are always in view, and the rest is read on asking.

It is a tool rather than a prompt or a resource because a tool is the one thing
the protocol leaves to the model to reach for. A prompt waits for a person to
choose it and a resource for a client to attach it, so neither would be read at
the moment the model finds it needs one.

Every guide is a Markdown file whose front matter states its name and what it
is for, so the line that decides whether it is read lives beside what it says.
The tool's description lists each guide by that line, and its argument names
them, so a caller sees what exists without reading any of it. Reading one hands
back what follows the front matter: the name and the line are already known by
then.

A guide holds what has been seen to work, and says so where it rests on
behaviour a provider does not document, since a caller relying on it should
know it can stop working without anything here changing.

## Includes

- `test/guide.spec.ts`

## `G-001` The tool is offered

| Step  | Statement                    |
| ----- | ---------------------------- |
| Given | an endpoint serving the tool |
| When  | a client lists the tools     |
| Then  | `read_guide` is among them   |

## `G-002` What guides there are

| Step  | Statement                                                             |
| ----- | --------------------------------------------------------------------- |
| Given | an endpoint serving the tool                                          |
| When  | a client lists the tools                                              |
| Then  | `read_guide` names every guide, and says in one line what each is for |

## `G-003` A guide is read

| Step  | Statement                                             |
| ----- | ----------------------------------------------------- |
| Given | the name of a guide                                   |
| When  | `read_guide` is called with it                        |
| Then  | the reply carries the guide, without its front matter |

## `G-004` A name that is no guide

| Step  | Statement                      |
| ----- | ------------------------------ |
| Given | a name no guide has            |
| When  | `read_guide` is called with it |
| Then  | the call fails                 |
