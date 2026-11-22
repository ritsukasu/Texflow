# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through GitHub's **Report a vulnerability** option on the Security tab of this repository.

Include what you found, the steps to reproduce it and the version or commit. You will receive an acknowledgement, and fixes are released as soon as they are verified.

## Scope

In scope: authentication and sessions, access control between users, the LaTeX build sandbox, file handling and anything that exposes data from another account or the host.

Out of scope: denial of service by exhausting a host that has not set the documented limits, and issues that require `ALLOW_LUALATEX=true`, which is documented as running user-supplied Lua.

## Deployment guidance

- Serve Texflow only over HTTPS and set `TRUST_PROXY` to the number of proxies in front of it.
- Run it in the provided container as a non-root user.
- Set `ALLOW_REGISTRATION=false` on private instances once your accounts exist.
- Back up the data directory. It holds the database and all project files.
