#!/usr/bin/env python3
"""Command line interface for daily-bench."""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

from daily_bench import extractor


def run_helm_lite() -> None:
    """Run the HELM Lite benchmark runner script."""
    # Get the directory where this script is located
    current_dir = Path(__file__).parent
    runner_script = current_dir / "helm_lite" / "run_bench.sh"

    if not runner_script.exists():
        print(f"Error: runner.sh not found at {runner_script}")
        sys.exit(1)

    # Make sure the script is executable
    os.chmod(runner_script, 0o755)

    # Change to the helm_lite directory to run the script
    original_cwd = os.getcwd()
    helm_lite_dir = current_dir / "helm_lite"

    try:
        os.chdir(helm_lite_dir)
        print(f"Running HELM Lite benchmark from {helm_lite_dir}")

        # Run the shell script
        result = subprocess.run(
            ["bash", str(runner_script)], check=False, cwd=helm_lite_dir
        )

        sys.exit(result.returncode)

    except KeyboardInterrupt:
        print("\nBenchmark interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"Error running benchmark: {e}")
        sys.exit(1)
    finally:
        os.chdir(original_cwd)


def run_results_extractor(
    results_location: Path, output_location: Path, incremental: bool = True
) -> None:
    """Run the results extractor function."""
    if incremental:
        data = extractor.extract_results_incremental(
            root=results_location, output_path=output_location
        )
        print(
            "Incremental extraction completed. ",
            f"Processed {data.get('new_runs_processed', 0)} new runs.",
        )
    else:
        data = extractor.extract_results(
            root=results_location, output_path=output_location
        )
        print("Full extraction completed.")

    extractor.report(data)
    print(f"Results extracted to {output_location}")

    # Copy results to dashboard for easy access
    dashboard_csv = Path("dashboard/benchmark_summary.csv")
    if dashboard_csv.parent.exists():
        shutil.copy(output_location, dashboard_csv)
        print(f"Results also copied to {dashboard_csv} for dashboard use")


def main() -> None:
    """Execute the main CLI entry point with subcommands."""
    parser = argparse.ArgumentParser(
        prog="daily-bench", description="Daily benchmarking for LLMs"
    )

    subparsers = parser.add_subparsers(
        dest="command", help="Available commands", required=True
    )

    # Add 'run' subcommand
    _ = subparsers.add_parser("run", help="Run the HELM Lite benchmark")

    # Add 'extract' subcommand
    extract_parser = subparsers.add_parser(
        "extract", help="Extract results from the HELM Lite benchmark"
    )
    extract_parser.add_argument(
        "--full",
        action="store_true",
        help="Perform full extraction instead of incremental (slower but processes all runs)",
    )

    args = parser.parse_args()

    if args.command == "run":
        run_helm_lite()
    elif args.command == "extract":
        current_dir = Path(__file__).parent
        results_location = current_dir / "helm_lite/benchmark_output/runs"
        output_location = current_dir.parent.parent / "results/benchmark_summary.csv"
        incremental = not args.full  # Use incremental unless --full is specified
        run_results_extractor(results_location, output_location, incremental)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
