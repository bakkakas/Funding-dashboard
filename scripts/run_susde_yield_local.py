#!/usr/bin/env python3
"""Model-free local scheduler entrypoint. Argument: dedicated runtime directory.

Ethena redirects GitHub-hosted runner requests to /restricted. Use the user's
ordinary local connection, which serves the public data, without proxies or
location-header overrides. Never operate on the user's working checkout.
"""
import datetime as dt
import fcntl
import os
from pathlib import Path
import subprocess
import sys


def main():
    base = Path(sys.argv[1]).resolve()
    base.mkdir(parents=True, exist_ok=True)
    repo = base / 'repo'
    os.environ['PATH'] = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'

    def run(*args, check=True, capture=False):
        return subprocess.run(args, check=check, text=True,
                              stdout=subprocess.PIPE if capture else None)

    def git(*args, **kwargs):
        return run('git', '-C', str(repo), *args, **kwargs)

    with (base / 'run.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        print(dt.datetime.now(dt.timezone.utc).isoformat(), 'start', flush=True)
        if not repo.exists():
            run('git', 'clone', '--single-branch', '--branch', 'main',
                'https://github.com/bakkakas/Funding-dashboard.git', str(repo))
        if git('status', '--porcelain', capture=True).stdout.strip():
            raise RuntimeError('Collector checkout has uncommitted files; preserved for inspection')
        git('pull', '--rebase', 'origin', 'main')
        # A failed fetch/validation never commits or pushes a substitute/zero.
        failures = []
        for script, snapshot in [('update_susde_yield.py', 'susde-yield.json'),
                                 ('update_susde_returns.py', 'susde-returns.json')]:
            result = run(sys.executable, str(repo / 'scripts' / script), check=False)
            if result.returncode:
                failures.append(script)
            else:
                git('add', 'data/' + snapshot)
        if git('diff', '--cached', '--quiet', check=False).returncode:
            git('-c', 'user.name=Senna', '-c', 'user.email=senna@users.noreply.github.com',
                'commit', '-m', 'chore: refresh official sUSDe APY and realized returns locally')
        for _ in range(3):
            git('pull', '--rebase', 'origin', 'main')
            if git('push', 'origin', 'HEAD:main', check=False).returncode == 0:
                break
        else:
            raise RuntimeError('Push failed; local commit preserved for next run')
        run('gh', 'api', '--method', 'POST', 'repos/bakkakas/Funding-dashboard/pages/builds')
        print(dt.datetime.now(dt.timezone.utc).isoformat(), 'complete', flush=True)
        if failures:
            raise RuntimeError('Partial collection failure (last good data retained): ' + ', '.join(failures))


if __name__ == '__main__':
    main()
