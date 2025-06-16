from pathlib import Path
import json
import pandas as pd
from typing import Any, Dict, List, Optional
import datetime
import csv


def harvest_helm_stats(root: str | Path = "benchmark_output/runs") -> pd.DataFrame:
    """
    Walk every stats.json under *root* and conglomerate
    metrics + minimal metadata into a dataframe.

    columns:
        model, run, timestamp, metric_name, split, count, sum, mean, etc.
    """
    rows: List[Dict[str, Any]] = []

    for stats_path in Path(root).rglob("stats.json"):
        # Load stats.json
        with stats_path.open() as f:
            stats_list: list[Dict[str, Any]] = json.load(f)

        # Load corresponding run_spec.json
        run_spec_path = stats_path.parent / "run_spec.json"
        run_spec = {}
        if run_spec_path.exists():
            with run_spec_path.open() as f:
                run_spec = json.load(f)

        # Extract metadata from run_spec
        model = run_spec.get("adapter_spec", {}).get("model", "unknown")
        run_name = run_spec.get("name", stats_path.parent.name)
        scenario_class = run_spec.get("scenario_spec", {}).get("class_name", "unknown")
        scenario_args = run_spec.get("scenario_spec", {}).get("args", {})
        
        # Get the suite name from the path structure: benchmark_output/runs/SUITE_NAME/scenario/stats.json
        suite_name = stats_path.parent.parent.name
        
        for stat_entry in stats_list:
            # Flatten the nested name dictionary
            name_dict = stat_entry.get("name", {})
            
            # Create row with base metadata + flattened name fields + other stat fields
            row = {
                "model": model,
                "run": suite_name,  # This now contains the timestamp-based suite name
                "run_name": run_name,
                "scenario_class": scenario_class,
            }
            
            # Add scenario args as separate columns
            for arg_key, arg_value in scenario_args.items():
                row[f"scenario_{arg_key}"] = arg_value
            
            # Add flattened name fields (metric_name, split, etc.)
            row.update(name_dict)
            
            # Add other statistical fields (count, sum, mean, etc.)
            for key, value in stat_entry.items():
                if key != "name":  # Skip the name dict since we already flattened it
                    row[key] = value
            
            rows.append(row)

    if len(rows) == 0:
        raise ValueError(f"No rows found in harvest_helm_stats! Along path {root}")

    return (
        pd.DataFrame(rows)
        .sort_values(["model", "run"], ascending=[True, True])
        .reset_index(drop=True)
    )


def harvest_run_specs(root: str | Path = "benchmark_output/runs") -> pd.DataFrame:
    """
    Extract detailed run specifications from all runs.
    
    Returns:
        DataFrame with run configuration details including adapter specs,
        metric specs, and data augmentation settings.
    """
    rows: List[Dict[str, Any]] = []
    
    for run_spec_path in Path(root).rglob("run_spec.json"):
        with run_spec_path.open() as f:
            run_spec = json.load(f)
        
        # Extract adapter spec details
        adapter_spec = run_spec.get("adapter_spec", {})
        
        # Base row with run identification
        row = {
            "run_id": run_spec_path.parent.name,
            "run_name": run_spec.get("name", "unknown"),
            # Scenario info
            "scenario_class": run_spec.get("scenario_spec", {}).get("class_name", "unknown"),
            # Model info  
            "model": adapter_spec.get("model", "unknown"),
            "model_deployment": adapter_spec.get("model_deployment", "unknown"),
            # Generation parameters
            "method": adapter_spec.get("method", "unknown"),
            "temperature": adapter_spec.get("temperature"),
            "max_tokens": adapter_spec.get("max_tokens"),
            "num_outputs": adapter_spec.get("num_outputs"),
            "num_trials": adapter_spec.get("num_trials"),
            "max_train_instances": adapter_spec.get("max_train_instances"),
            "max_eval_instances": adapter_spec.get("max_eval_instances"),
            # Prompt template info
            "instructions": adapter_spec.get("instructions", ""),
            "input_prefix": adapter_spec.get("input_prefix", ""),
            "output_prefix": adapter_spec.get("output_prefix", ""),
            "stop_sequences": str(adapter_spec.get("stop_sequences", [])),
            # Groups/tags
            "groups": str(run_spec.get("groups", [])),
        }
        
        # Add scenario args
        scenario_args = run_spec.get("scenario_spec", {}).get("args", {})
        for arg_key, arg_value in scenario_args.items():
            row[f"scenario_{arg_key}"] = arg_value
            
        # Add metric specs
        metric_specs = run_spec.get("metric_specs", [])
        row["metric_classes"] = str([m.get("class_name", "") for m in metric_specs])
        
        rows.append(row)
    
    return pd.DataFrame(rows).sort_values("run_id").reset_index(drop=True)


def harvest_instances(root: str | Path = "benchmark_output/runs") -> pd.DataFrame:
    """
    Extract all evaluation instances with their inputs, references, and metadata.
    
    Returns:
        DataFrame with one row per instance containing the question, 
        reference answers, and instance metadata.
    """
    rows: List[Dict[str, Any]] = []
    
    for instances_path in Path(root).rglob("instances.json"):
        with instances_path.open() as f:
            instances = json.load(f)
        
        run_id = instances_path.parent.name
        
        # Get run spec for context
        run_spec_path = instances_path.parent / "run_spec.json"
        model = "unknown"
        scenario_class = "unknown"
        if run_spec_path.exists():
            with run_spec_path.open() as f:
                run_spec = json.load(f)
                model = run_spec.get("adapter_spec", {}).get("model", "unknown")
                scenario_class = run_spec.get("scenario_spec", {}).get("class_name", "unknown")
        
        for instance in instances:
            # Extract references
            references = instance.get("references", [])
            reference_texts = [ref.get("output", {}).get("text", "") for ref in references]
            reference_tags = [str(ref.get("tags", [])) for ref in references]
            
            row = {
                "run_id": run_id,
                "model": model,
                "scenario_class": scenario_class,
                "instance_id": instance.get("id", ""),
                "split": instance.get("split", ""),
                "input_text": instance.get("input", {}).get("text", ""),
                "num_references": len(references),
                "reference_texts": str(reference_texts),
                "reference_tags": str(reference_tags),
            }
            
            rows.append(row)
    
    return pd.DataFrame(rows).sort_values(["run_id", "instance_id"]).reset_index(drop=True)


def harvest_per_instance_stats(root: str | Path = "benchmark_output/runs") -> pd.DataFrame:
    """
    Extract per-instance statistics for detailed analysis.
    
    Returns:
        DataFrame with performance metrics for each individual instance.
    """
    rows: List[Dict[str, Any]] = []
    
    for per_instance_path in Path(root).rglob("per_instance_stats.json"):
        with per_instance_path.open() as f:
            per_instance_data = json.load(f)
        
        run_id = per_instance_path.parent.name
        
        # Get model info from run spec
        run_spec_path = per_instance_path.parent / "run_spec.json"
        model = "unknown"
        if run_spec_path.exists():
            with run_spec_path.open() as f:
                run_spec = json.load(f)
                model = run_spec.get("adapter_spec", {}).get("model", "unknown")
        
        for instance_data in per_instance_data:
            instance_id = instance_data.get("instance_id", "")
            train_trial_index = instance_data.get("train_trial_index", 0)
            
            # Process each stat for this instance
            for stat in instance_data.get("stats", []):
                name_dict = stat.get("name", {})
                
                row = {
                    "run_id": run_id,
                    "model": model,
                    "instance_id": instance_id,
                    "train_trial_index": train_trial_index,
                }
                
                # Add metric name and split
                row.update(name_dict)
                
                # Add statistical measures
                for key, value in stat.items():
                    if key != "name":
                        row[key] = value
                
                rows.append(row)
    
    return pd.DataFrame(rows).sort_values(["run_id", "instance_id", "name"]).reset_index(drop=True)


def harvest_scenario_metadata(root: str | Path = "benchmark_output/runs") -> pd.DataFrame:
    """
    Extract scenario metadata and descriptions.
    """
    rows: List[Dict[str, Any]] = []
    
    for scenario_path in Path(root).rglob("scenario.json"):
        with scenario_path.open() as f:
            scenario_data = json.load(f)
        
        run_id = scenario_path.parent.name
        
        row = {
            "run_id": run_id,
            "scenario_name": scenario_data.get("name", ""),
            "scenario_description": scenario_data.get("description", ""),
            "scenario_tags": str(scenario_data.get("tags", [])),
            "definition_path": scenario_data.get("definition_path", ""),
        }
        
        rows.append(row)
    
    return pd.DataFrame(rows).sort_values("run_id").reset_index(drop=True)


def harvest_scenario_state(root: str | Path = "benchmark_output/runs") -> pd.DataFrame:
    """
    Extract scenario state data including request/response information.
    
    Returns:
        DataFrame with detailed request/response data for each instance.
    """
    rows: List[Dict[str, Any]] = []
    
    for scenario_state_path in Path(root).rglob("scenario_state.json"):
        with scenario_state_path.open() as f:
            scenario_state = json.load(f)
        
        run_id = scenario_state_path.parent.name
        
        # Extract adapter spec info (same for all instances in this run)
        adapter_spec = scenario_state.get("adapter_spec", {})
        
        # Process each request state
        for request_state in scenario_state.get("request_states", []):
            instance = request_state.get("instance", {})
            request = request_state.get("request", {})
            result = request_state.get("result", {})
            
            # Get first completion (there's usually only one for generation tasks)
            completion = result.get("completions", [{}])[0] if result.get("completions") else {}
            
            row = {
                "run_id": run_id,
                # Instance info
                "instance_id": instance.get("id", ""),
                "split": instance.get("split", ""),
                "input_text": instance.get("input", {}).get("text", ""),
                "train_trial_index": request_state.get("train_trial_index", 0),
                "num_train_instances": request_state.get("num_train_instances", 0),
                
                # Request info
                "model": request.get("model", ""),
                "temperature": request.get("temperature"),
                "max_tokens": request.get("max_tokens"),
                "num_completions": request.get("num_completions"),
                "stop_sequences": str(request.get("stop_sequences", [])),
                "prompt": request.get("prompt", ""),
                
                # Result info
                "success": result.get("success", False),
                "cached": result.get("cached", False),
                "request_time": result.get("request_time"),
                "request_datetime": result.get("request_datetime"),
                "completion_text": completion.get("text", ""),
                "completion_logprob": completion.get("logprob"),
                "num_tokens": len(completion.get("tokens", [])),
                
                # Adapter spec info (for reference)
                "method": adapter_spec.get("method", ""),
                "instructions": adapter_spec.get("instructions", ""),
                "input_prefix": adapter_spec.get("input_prefix", ""),
                "output_prefix": adapter_spec.get("output_prefix", ""),
                "prompt_truncated": request_state.get("prompt_truncated", False),
                "num_conditioning_tokens": request_state.get("num_conditioning_tokens", 0),
                
                # Reference answers
                "num_references": len(instance.get("references", [])),
                "reference_texts": str([ref.get("output", {}).get("text", "") 
                                      for ref in instance.get("references", [])]),
            }
            
            rows.append(row)
    
    return pd.DataFrame(rows).sort_values(["run_id", "instance_id"]).reset_index(drop=True)


def create_comprehensive_report(root: str | Path = "benchmark_output/runs") -> Dict[str, pd.DataFrame]:
    """
    Create a comprehensive report with all available evaluation data.
    
    Returns:
        Dictionary containing multiple DataFrames with different aspects
        of the evaluation results.
    """
    
    report = {
        "stats": harvest_helm_stats(root),
        "run_specs": harvest_run_specs(root), 
        "instances": harvest_instances(root),
        "per_instance_stats": harvest_per_instance_stats(root),
        "scenario_metadata": harvest_scenario_metadata(root),
        "scenario_state": harvest_scenario_state(root),
    }
    
    return report


def merge_run_level_data(report: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Merge run-level data (stats, run_specs, scenario_metadata) into a single DataFrame.
    
    Args:
        report: Dictionary of DataFrames from create_comprehensive_report()
        
    Returns:
        Merged DataFrame with all run-level information
    """
    stats_df = report["stats"].copy()
    run_specs_df = report["run_specs"].copy()
    scenario_metadata_df = report["scenario_metadata"].copy()
    
    # Use 'run' column from stats as the key (matches run_id in other DFs)
    stats_df = stats_df.rename(columns={"run": "run_id"})
    
    # Merge run specs
    merged_df = stats_df.merge(
        run_specs_df, 
        on="run_id", 
        how="left",
        suffixes=("", "_spec")
    )
    
    # Merge scenario metadata
    merged_df = merged_df.merge(
        scenario_metadata_df,
        on="run_id",
        how="left"
    )
    
    # Clean up duplicate columns
    # Keep the original model column, drop model_spec if it exists
    if "model_spec" in merged_df.columns:
        merged_df = merged_df.drop(columns=["model_spec"])
    
    return merged_df


def merge_instance_level_data(report: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Merge instance-level data (instances, scenario_state) with run metadata.
    
    Args:
        report: Dictionary of DataFrames from create_comprehensive_report()
        
    Returns:
        Merged DataFrame with all instance-level information
    """
    instances_df = report["instances"].copy() 
    scenario_state_df = report["scenario_state"].copy()
    run_specs_df = report["run_specs"].copy()
    scenario_metadata_df = report["scenario_metadata"].copy()
    
    # Start with scenario_state as the base since it has the most detailed info
    merged_df = scenario_state_df.copy()
    
    # Add instances data (merge on run_id and instance_id)
    merged_df = merged_df.merge(
        instances_df[["run_id", "instance_id", "scenario_class", "reference_tags"]],
        on=["run_id", "instance_id"],
        how="left",
        suffixes=("", "_inst")
    )
    
    # Add run specifications
    merged_df = merged_df.merge(
        run_specs_df[["run_id", "run_name", "scenario_class", "num_trials", 
                     "max_eval_instances", "groups"]],
        on="run_id",
        how="left",
        suffixes=("", "_spec")
    )
    
    # Add scenario metadata
    merged_df = merged_df.merge(
        scenario_metadata_df,
        on="run_id", 
        how="left"
    )
    
    # Clean up duplicate columns - prefer scenario_state versions
    if "scenario_class_inst" in merged_df.columns:
        merged_df = merged_df.drop(columns=["scenario_class_inst"])
    if "scenario_class_spec" in merged_df.columns:
        merged_df = merged_df.drop(columns=["scenario_class_spec"])
    
    return merged_df


def extract_run_timestamp(run_id: str) -> Optional[datetime.datetime]:
    """
    Extract timestamp from run_id (assumes format like 'results-20250608_112220').
    
    Args:
        run_id: The run identifier
        
    Returns:
        datetime object if timestamp can be parsed, None otherwise
    """
    import re
    
    # Look for pattern like 'results-20250608_112220' or just '20250608_112220'
    timestamp_pattern = r'(\d{8}_\d{6})'
    match = re.search(timestamp_pattern, run_id)
    if match:
        timestamp_str = match.group(1)
        try:
            return datetime.datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
        except ValueError:
            pass
    
    return None


def add_temporal_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add temporal analysis columns to a dataframe with run_id or run column.
    
    Args:
        df: DataFrame with 'run_id' or 'run' column
        
    Returns:
        DataFrame with added temporal columns
    """
    df = df.copy()
    
    # Handle both 'run_id' and 'run' column names
    run_col = 'run_id' if 'run_id' in df.columns else 'run'
    if run_col not in df.columns:
        raise ValueError("DataFrame must have either 'run_id' or 'run' column")
    
    # Extract timestamps
    df['run_timestamp'] = df[run_col].apply(extract_run_timestamp)
    
    # Add date components for easier filtering
    df['run_date'] = df['run_timestamp'].dt.date
    df['run_hour'] = df['run_timestamp'].dt.hour
    df['run_weekday'] = df['run_timestamp'].dt.day_name()
    
    # Add time-based sorting
    df = df.sort_values('run_timestamp', na_position='last')
    
    return df


def get_model_dataset_combos(df: pd.DataFrame) -> pd.DataFrame:
    """
    Get unique model-dataset combinations with their run history.
    
    Args:
        df: DataFrame with model and scenario_class columns
        
    Returns:
        DataFrame with model-dataset combinations and run counts
    """
    df_with_time = add_temporal_columns(df)
    
    # Handle both 'run_id' and 'run' column names
    run_col = 'run_id' if 'run_id' in df_with_time.columns else 'run'
    
    combo_summary = (df_with_time
                    .groupby(['model', 'scenario_class'])
                    .agg({
                        run_col: ['count', 'nunique'],
                        'run_timestamp': ['min', 'max'],
                        'run_date': 'nunique'
                    })
                    .round(3))
    
    # Flatten column names
    combo_summary.columns = ['_'.join(col).strip() for col in combo_summary.columns]
    combo_summary = combo_summary.rename(columns={
        f'{run_col}_count': 'total_instances',
        f'{run_col}_nunique': 'unique_runs',
        'run_timestamp_min': 'first_run',
        'run_timestamp_max': 'last_run',
        'run_date_nunique': 'unique_days'
    })
    
    combo_summary = combo_summary.reset_index()
    combo_summary['days_span'] = (combo_summary['last_run'] - combo_summary['first_run']).dt.days
    
    return combo_summary.sort_values(['model', 'scenario_class'])


def track_model_dataset_over_time(df: pd.DataFrame, model: str, dataset: str, 
                                 metric_columns: List[str] = None) -> pd.DataFrame:
    """
    Track a specific model-dataset combination over time.
    
    Args:
        df: DataFrame with stats/performance data
        model: Model name to filter for
        dataset: Dataset/scenario_class name to filter for  
        metric_columns: List of metric columns to track. If None, will find numeric columns.
        
    Returns:
        DataFrame with time-series data for the model-dataset combo
    """
    df_with_time = add_temporal_columns(df)
    
    # Filter for specific model-dataset combo
    filtered_df = df_with_time[
        (df_with_time['model'] == model) & 
        (df_with_time['scenario_class'] == dataset)
    ].copy()
    
    if filtered_df.empty:
        print(f"No data found for model='{model}' and dataset='{dataset}'")
        return pd.DataFrame()
    
    # If no metric columns specified, find numeric columns (excluding temporal ones)
    if metric_columns is None:
        exclude_cols = ['run_timestamp', 'run_date', 'run_hour', 'instance_id', 'train_trial_index']
        metric_columns = [col for col in filtered_df.select_dtypes(include=['number']).columns 
                         if col not in exclude_cols]
    
    # Handle both 'run_id' and 'run' column names
    run_col = 'run_id' if 'run_id' in filtered_df.columns else 'run'
    
    # Group by run to get run-level statistics
    time_series = (filtered_df
                  .groupby([run_col, 'run_timestamp', 'run_date'])
                  [metric_columns]
                  .agg(['mean', 'std', 'count'])
                  .round(4))
    
    # Flatten column names
    time_series.columns = ['_'.join(col).strip() for col in time_series.columns]
    time_series = time_series.reset_index()
    
    # Sort by timestamp
    time_series = time_series.sort_values('run_timestamp')
    
    # Add run sequence number
    time_series['run_sequence'] = range(1, len(time_series) + 1)
    
    return time_series


def compare_recent_runs(df: pd.DataFrame, model: str, dataset: str, 
                       last_n_runs: int = 3, metric_columns: List[str] = None) -> Dict[str, Any]:
    """
    Compare performance across the most recent N runs for a model-dataset combo.
    
    Args:
        df: DataFrame with stats/performance data
        model: Model name
        dataset: Dataset/scenario_class name
        last_n_runs: Number of recent runs to compare
        metric_columns: List of metrics to compare
        
    Returns:
        Dictionary with comparison results
    """
    time_series = track_model_dataset_over_time(df, model, dataset, metric_columns)
    
    if time_series.empty or len(time_series) < 2:
        return {"error": "Not enough runs to compare"}
    
    # Get the most recent runs
    recent_runs = time_series.tail(last_n_runs).copy()
    
    # Find mean columns (performance metrics)
    mean_cols = [col for col in recent_runs.columns if col.endswith('_mean')]
    
    comparison = {
        "model": model,
        "dataset": dataset,
        "runs_compared": len(recent_runs),
        "time_span": {
            "first_run": recent_runs['run_timestamp'].min(),
            "last_run": recent_runs['run_timestamp'].max(),
            "days": (recent_runs['run_timestamp'].max() - recent_runs['run_timestamp'].min()).days
        },
        "metrics": {}
    }
    
    # Calculate statistics for each metric
    for col in mean_cols:
        metric_name = col.replace('_mean', '')
        values = recent_runs[col].dropna()
        
        if len(values) > 0:
            comparison["metrics"][metric_name] = {
                "latest_value": float(values.iloc[-1]),
                "mean": float(values.mean()),
                "std": float(values.std()) if len(values) > 1 else 0.0,
                "min": float(values.min()),
                "max": float(values.max()),
                "trend": "improving" if len(values) > 1 and values.iloc[-1] > values.iloc[0] else "declining" if len(values) > 1 and values.iloc[-1] < values.iloc[0] else "stable"
            }
    
    return comparison


def get_performance_summary_by_time(df: pd.DataFrame, 
                                   metric_columns: List[str] = None,
                                   group_by_day: bool = True) -> pd.DataFrame:
    """
    Get performance summary grouped by time periods.
    
    Args:
        df: DataFrame with stats data
        metric_columns: List of metrics to summarize
        group_by_day: If True, group by day; if False, group by individual runs
        
    Returns:
        DataFrame with performance over time
    """
    df_with_time = add_temporal_columns(df)
    
    if metric_columns is None:
        exclude_cols = ['run_timestamp', 'run_date', 'run_hour', 'instance_id', 'train_trial_index']
        metric_columns = [col for col in df_with_time.select_dtypes(include=['number']).columns 
                         if col not in exclude_cols]
    
    # Handle both 'run_id' and 'run' column names
    run_col = 'run_id' if 'run_id' in df_with_time.columns else 'run'
    
    # Group by time period and model-dataset combo
    group_cols = ['model', 'scenario_class']
    if group_by_day:
        group_cols.append('run_date')
        time_col = 'run_date'
    else:
        group_cols.extend([run_col, 'run_timestamp'])
        time_col = 'run_timestamp'
    
    summary = (df_with_time
              .groupby(group_cols)
              [metric_columns]
              .agg(['mean', 'count'])
              .round(4))
    
    # Flatten column names
    summary.columns = ['_'.join(col).strip() for col in summary.columns]
    summary = summary.reset_index()
    
    # Sort by time
    summary = summary.sort_values([time_col, 'model', 'scenario_class'])
    
    return summary


def extract_results_incremental(root: str | Path = "benchmark_output/runs", 
                               output_path: str | Path = "results/benchmark_summary.csv") -> Dict[str, Any]:
    """
    Extract and process only NEW benchmark data, appending to existing CSV.
    
    Args:
        root: Root directory containing benchmark runs
        output_path: Path to save final summary CSV
        
    Returns:
        Dictionary containing processed data for reporting
    """
    print(f"Looking for existing results at: {output_path}")
    
    # Get existing run IDs from CSV
    existing_run_ids = get_existing_run_ids(output_path)
    print(f"Found {len(existing_run_ids)} existing run IDs")
    
    # Find new runs
    new_run_paths = find_new_runs(root, existing_run_ids)
    print(f"Found {len(new_run_paths)} new runs to process")
    
    if not new_run_paths:
        print("No new runs found - loading existing data for reporting")
        if Path(output_path).exists():
            final_df = pd.read_csv(output_path)
            stats_df = add_temporal_columns(final_df)
            combos = get_model_dataset_combos(stats_df)
            
            # Generate analysis on existing data
            time_series = None
            comparison = None
            example_model = None
            example_dataset = None
            
            if not combos.empty:
                example_model = combos.iloc[0]['model']
                example_dataset = combos.iloc[0]['scenario_class']
                time_series = track_model_dataset_over_time(stats_df, example_model, example_dataset)
                comparison = compare_recent_runs(stats_df, example_model, example_dataset, last_n_runs=3)
            
            return {
                "report": {},
                "stats_df": stats_df,
                "combos": combos,
                "time_series": time_series,
                "comparison": comparison,
                "final_df": final_df,
                "example_model": example_model,
                "example_dataset": example_dataset,
                "output_path": output_path,
                "new_runs_processed": 0
            }
        else:
            # No existing file, process all runs
            return extract_results(root, output_path)
    
    # Process only new runs
    print(f"Processing new runs: {[p.name for p in new_run_paths]}")
    new_stats_df = harvest_helm_stats_from_runs(new_run_paths)
    
    if new_stats_df.empty:
        print("No new stats found in new runs")
        return extract_results_incremental(root, output_path)  # Return existing data
    
    # Add temporal information
    new_stats_df = add_temporal_columns(new_stats_df)
    
    # Apply the same filtering as the original extract_results
    keep_metric_names = ['perplexity', 'exact_match', 'f1_score', 'bleu_4', 'rouge_l']
    if 'name' in new_stats_df.columns:
        new_stats_df = new_stats_df[new_stats_df.name.isin(keep_metric_names)].reset_index(drop=True)
    
    # Load existing data if it exists
    if Path(output_path).exists():
        existing_df = pd.read_csv(output_path)
        # Combine with new data
        final_df = pd.concat([existing_df, new_stats_df], ignore_index=True)
    else:
        final_df = new_stats_df
    
    # Reorder columns for better readability (same as original)
    key_columns = [
        'model', 
        'scenario_class',
        'run_timestamp', 
        'run_date',
        'run_id' if 'run_id' in final_df.columns else 'run',
        'metric_name',
        'split'
    ]
    
    # Add all metric/stat columns
    metric_columns = [col for col in final_df.columns 
                     if col in ['count', 'sum', 'mean', 'min', 'max', 'std', 'variance', 'p25', 'p50', 'p75', 'p90', 'p95', 'p99']]
    
    # Add any remaining columns that might be useful
    other_columns = [col for col in final_df.columns 
                    if col not in key_columns + metric_columns + ['run_hour', 'run_weekday']]
    
    # Final column order
    final_column_order = key_columns + metric_columns + other_columns
    final_column_order = [col for col in final_column_order if col in final_df.columns]
    
    final_df = final_df[final_column_order]
    
    # Sort by model, scenario, timestamp, and metric name for consistent ordering
    sort_columns = ['model', 'scenario_class', 'run_timestamp', 'name']
    sort_columns = [col for col in sort_columns if col in final_df.columns]
    final_df = final_df.sort_values(sort_columns).reset_index(drop=True)
    
    # Ensure output directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    # Save to CSV with proper line endings and quoting
    final_df.to_csv(output_path, index=False, lineterminator='\n', quoting=csv.QUOTE_MINIMAL)
    print(f"Updated CSV saved with {len(final_df)} total rows ({len(new_stats_df)} new rows)")
    
    # Generate analysis on full dataset
    stats_df = add_temporal_columns(final_df)
    combos = get_model_dataset_combos(stats_df)
    
    # Track example model-dataset combo over time (if available)
    time_series = None
    comparison = None
    example_model = None
    example_dataset = None
    
    if not combos.empty:
        example_model = combos.iloc[0]['model']
        example_dataset = combos.iloc[0]['scenario_class']
        time_series = track_model_dataset_over_time(stats_df, example_model, example_dataset)
        comparison = compare_recent_runs(stats_df, example_model, example_dataset, last_n_runs=3)
    
    return {
        "report": {},
        "stats_df": stats_df,
        "combos": combos,
        "time_series": time_series,
        "comparison": comparison,
        "final_df": final_df,
        "example_model": example_model,
        "example_dataset": example_dataset,
        "output_path": output_path,
        "new_runs_processed": len(new_run_paths)
    }


def extract_results(root: str | Path = "benchmark_output/runs", 
            output_path: str | Path = "results/benchmark_summary.csv") -> Dict[str, Any]:
    """
    Extract and process all benchmark data, save final summary to CSV.
    (Legacy function - use extract_results_incremental for better performance)
    
    Args:
        root: Root directory containing benchmark runs
        output_path: Path to save final summary CSV
        
    Returns:
        Dictionary containing processed data for reporting
    """
    # Create comprehensive report
    report = create_comprehensive_report(root)
    
    # Get the main stats dataframe with temporal information
    stats_df = add_temporal_columns(report["stats"])
    
    # Get model-dataset combinations
    combos = get_model_dataset_combos(stats_df)
    
    # Track example model-dataset combo over time (if available)
    time_series = None
    comparison = None
    example_model = None
    example_dataset = None
    
    if not combos.empty:
        example_model = combos.iloc[0]['model']
        example_dataset = combos.iloc[0]['scenario_class']
        time_series = track_model_dataset_over_time(stats_df, example_model, example_dataset)
        comparison = compare_recent_runs(stats_df, example_model, example_dataset, last_n_runs=3)
    
    # Create the final clean dataframe with all key information
    final_df = stats_df.copy()
    
    # Reorder columns for better readability
    key_columns = [
        'model', 
        'scenario_class',
        'run_timestamp', 
        'run_date',
        'run_id' if 'run_id' in final_df.columns else 'run',
        'metric_name',
        'split'
    ]
    
    # Add all metric/stat columns
    metric_columns = [col for col in final_df.columns 
                     if col in ['count', 'sum', 'mean', 'min', 'max', 'std', 'variance', 'p25', 'p50', 'p75', 'p90', 'p95', 'p99']]
    
    keep_metric_names = ['perplexity', 'exact_match', 'f1_score', 'bleu_4', 'rouge_l']
    final_df = final_df[final_df.name.isin(keep_metric_names)].reset_index(drop=True)

    # Add any remaining columns that might be useful
    other_columns = [col for col in final_df.columns 
                    if col not in key_columns + metric_columns + ['run_hour', 'run_weekday']]
    
    # Final column order
    final_column_order = key_columns + metric_columns + other_columns
    final_column_order = [col for col in final_column_order if col in final_df.columns]
    
    final_df = final_df[final_column_order]
    
    # Sort by model, scenario, and timestamp for nice ordering
    sort_columns = ['model', 'scenario_class', 'run_timestamp', 'metric_name']
    sort_columns = [col for col in sort_columns if col in final_df.columns]
    final_df = final_df.sort_values(sort_columns).reset_index(drop=True)
    
    # Ensure output directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    # Save to CSV
    final_df.to_csv(output_path, index=False)
    
    return {
        "report": report,
        "stats_df": stats_df,
        "combos": combos,
        "time_series": time_series,
        "comparison": comparison,
        "final_df": final_df,
        "example_model": example_model,
        "example_dataset": example_dataset,
        "output_path": output_path
    }


def report(data: Dict[str, Any]) -> None:
    """
    Print comprehensive analysis report from extracted data.
    
    Args:
        data: Dictionary returned from extract() function
    """
    report_dict = data.get("report", {})
    stats_df = data["stats_df"]
    combos = data["combos"]
    time_series = data["time_series"]
    comparison = data["comparison"]
    final_df = data["final_df"]
    example_model = data["example_model"]
    example_dataset = data["example_dataset"]
    output_path = data["output_path"]
    new_runs_processed = data.get("new_runs_processed", "unknown")
    
    print("Report summary:")
    if report_dict:
        for name, df in report_dict.items():
            print(f"  {name}: {len(df)} rows, {len(df.columns)} columns")
    else:
        print(f"  Incremental processing: {new_runs_processed} new runs processed")
    
    print("\n" + "="*50)
    print("TEMPORAL ANALYSIS")
    print("="*50)
    
    print(f"\nStats DataFrame: {len(stats_df)} rows, {len(stats_df.columns)} columns")
    print(f"Date range: {stats_df['run_date'].min()} to {stats_df['run_date'].max()}")
    # Handle both 'run_id' and 'run' column names
    run_col = 'run_id' if 'run_id' in stats_df.columns else 'run'
    print(f"Unique runs: {stats_df[run_col].nunique()}")
    
    # Show model-dataset combinations
    print(f"\nModel-Dataset Combinations:")
    print(combos.to_string())
    
    # Example: Track a specific model-dataset combo over time
    if time_series is not None and not time_series.empty:
        print(f"\n" + "-"*50)
        print(f"TRACKING: {example_model} on {example_dataset}")
        print("-"*50)
        
        print(f"\nTime series data ({len(time_series)} runs):")
        # Handle both 'run_id' and 'run' column names
        run_col = 'run_id' if 'run_id' in time_series.columns else 'run'
        print(time_series[[run_col, 'run_date', 'run_sequence']].to_string())
        
        # Compare recent runs
        print(f"\nRecent runs comparison:")
        if comparison and "error" not in comparison:
            print(f"  Runs compared: {comparison['runs_compared']}")
            print(f"  Time span: {comparison['time_span']['days']} days")
            for metric, data in comparison['metrics'].items():
                print(f"  {metric}: {data['latest_value']:.3f} (trend: {data['trend']})")
    
    print(f"\n" + "="*50)
    print("FINAL SUMMARY")
    print("="*50)
    
    print(f"Final summary dataframe saved to: {output_path}")
    print(f"Shape: {final_df.shape}")
    print(f"Columns: {list(final_df.columns)}")
    print(f"\nFirst few rows:")
    print(final_df.head().to_string())


    # Always show incremental info if available
    if new_runs_processed != "unknown":
        print(f"\nINCREMENTAL EXTRACTION SUMMARY:")
        print(f"   New runs processed: {new_runs_processed}")
        if new_runs_processed == 0:
            print("   No new runs found - all data is up to date")
        else:
            print(f"   Successfully added {new_runs_processed} new run(s) to the dataset")


def get_existing_run_ids(csv_path: str | Path) -> set[str]:
    """
    Get the set of run IDs already present in the existing CSV file.
    
    Args:
        csv_path: Path to existing CSV file
        
    Returns:
        Set of run IDs that are already processed
    """
    if not Path(csv_path).exists():
        return set()
    
    try:
        existing_df = pd.read_csv(csv_path)
        # Handle both 'run_id' and 'run' column names
        if 'run_id' in existing_df.columns:
            return set(existing_df['run_id'].unique())
        elif 'run' in existing_df.columns:
            return set(existing_df['run'].unique())
        else:
            return set()
    except Exception as e:
        print(f"Warning: Could not read existing CSV {csv_path}: {e}")
        return set()


def find_new_runs(root: str | Path, existing_run_ids: set[str]) -> List[Path]:
    """
    Find run directories that are not in the existing run IDs.
    
    Args:
        root: Root directory containing benchmark runs
        existing_run_ids: Set of run IDs already processed
        
    Returns:
        List of paths to new run directories
    """
    new_run_paths = []
    
    for stats_path in Path(root).rglob("stats.json"):
        run_id = stats_path.parent.parent.name  # Get suite name from path structure
        if run_id not in existing_run_ids:
            new_run_paths.append(stats_path.parent.parent)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_new_runs = []
    for path in new_run_paths:
        if path not in seen:
            seen.add(path)
            unique_new_runs.append(path)
    
    return unique_new_runs


def harvest_helm_stats_from_runs(run_paths: List[Path]) -> pd.DataFrame:
    """
    Extract stats from specific run paths only.
    
    Args:
        run_paths: List of run directory paths to process
        
    Returns:
        DataFrame with stats from only the specified runs
    """
    rows: List[Dict[str, Any]] = []

    for run_path in run_paths:
        for stats_path in run_path.rglob("stats.json"):
            # Load stats.json
            with stats_path.open() as f:
                stats_list: list[Dict[str, Any]] = json.load(f)

            # Load corresponding run_spec.json
            run_spec_path = stats_path.parent / "run_spec.json"
            run_spec = {}
            if run_spec_path.exists():
                with run_spec_path.open() as f:
                    run_spec = json.load(f)

            # Extract metadata from run_spec
            model = run_spec.get("adapter_spec", {}).get("model", "unknown")
            run_name = run_spec.get("name", stats_path.parent.name)
            scenario_class = run_spec.get("scenario_spec", {}).get("class_name", "unknown")
            scenario_args = run_spec.get("scenario_spec", {}).get("args", {})
            
            # Get the suite name from the path structure: benchmark_output/runs/SUITE_NAME/scenario/stats.json
            suite_name = stats_path.parent.parent.name
            
            for stat_entry in stats_list:
                # Flatten the nested name dictionary
                name_dict = stat_entry.get("name", {})
                
                # Create row with base metadata + flattened name fields + other stat fields
                row = {
                    "model": model,
                    "run": suite_name,  # This now contains the timestamp-based suite name
                    "run_name": run_name,
                    "scenario_class": scenario_class,
                }
                
                # Add scenario args as separate columns
                for arg_key, arg_value in scenario_args.items():
                    row[f"scenario_{arg_key}"] = arg_value
                
                # Add flattened name fields (metric_name, split, etc.)
                row.update(name_dict)
                
                # Add other statistical fields (count, sum, mean, etc.)
                for key, value in stat_entry.items():
                    if key != "name":  # Skip the name dict since we already flattened it
                        row[key] = value
                
                rows.append(row)

    if len(rows) == 0:
        # Return empty DataFrame with expected columns
        return pd.DataFrame(columns=["model", "run", "run_name", "scenario_class"])

    return (
        pd.DataFrame(rows)
        .sort_values(["model", "run"], ascending=[True, True])
        .reset_index(drop=True)
    )
