import argparse

from tinybench_runner.run import run_bench
# from .build_site import build_site_main


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="tinybench-run")
    sub = p.add_subparsers(dest="cmd", required=True)

    run_p = sub.add_parser("run", help="execute one benchmark")
    run_p.add_argument("--provider-interface", required=True)
    run_p.add_argument("--model", required=True)

    sub.add_parser("build-site", help="emit static dashboard")

    return p.parse_args()


def main() -> None:
    args = _parse_args()
    if args.cmd == "run":
        run_bench(provider_interface=args.provider_interface, model=args.model)
    # elif args.cmd == "build-site":
    #     build_site_main()
    breakpoint()


if __name__ == "__main__":
    main()
