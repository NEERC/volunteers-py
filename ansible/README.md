# Staging server

`staging.yml` prepares a clean Ubuntu 24.04 cloud image as the server of the test stands
(`deploy/README.md`):

- Docker Engine and the compose plugin from the Docker repository, log rotation and a daily
  removal of unused images;
- the `deploy` user in the `docker` group, which only accepts a generated ed25519 key, and
  no SSH password or root logins;
- nginx-proxy with acme-companion on ports 80/443 and the `proxy` network the stands join.

Ports 80 and 443 of the server have to be reachable from the internet (Let's Encrypt
HTTP-01 challenge), and `*.<STAND_DOMAIN>` has to point to it.

The disk needs at least 15 GB free on `/` (cloud images come with ~3 GB, resize the disk
first, cloud-init grows the partition on boot).

## Running

Requires `ansible-core` 2.15+ on the control machine and SSH access to the server as the
default user of the image (with passwordless sudo).

```bash
cp ansible/inventory.example.yml ansible/inventory.yml   # set the address of the server
cd ansible && ansible-playbook staging.yml
```

The deploy key is generated once into `ansible/.keys/` (gitignored, keep it). The last task
prints `gh` commands that set the repository variables and the `STAND_SSH_KEY` secret: the
**private** key goes to GitHub, the public one is in `~deploy/.ssh/authorized_keys`. When
GitHub runners reach the server at another address or port (port forwarding), set
`stand_public_host` and `stand_public_port` in the inventory, `known_hosts` is printed for them.

The playbook is idempotent, rerun it to update the server.
