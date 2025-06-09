#!/usr/bin/env python3
"""Command line interface for daily-bench."""

import argparse
import os
import subprocess
import sys
from pathlib import Path


def run_helm_lite() -> None:
    """Run the HELM Lite benchmark runner script."""
    # Get the directory where this script is located
    current_dir = Path(__file__).parent
    runner_script = current_dir / "helm_lite" / "runner.sh"
    
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
            ["bash", str(runner_script)],
            check=False,
            cwd=helm_lite_dir
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


def main() -> None:
    """Main CLI entry point with subcommands."""
    parser = argparse.ArgumentParser(
        prog="daily-bench",
        description="Daily benchmarking for LLMs"
    )
    
    subparsers = parser.add_subparsers(
        dest="command",
        help="Available commands",
        required=True
    )
    
    # Add 'run' subcommand
    run_parser = subparsers.add_parser(
        "run",
        help="Run the HELM Lite benchmark"
    )
    
    args = parser.parse_args()
    
    if args.command == "run":
        run_helm_lite()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main() 