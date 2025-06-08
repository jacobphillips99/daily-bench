from pathlib import Path
import json
import pandas as pd
from typing import Any, Dict, List, Optional
import datetime


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
        
        for stat_entry in stats_list:
            # Flatten the nested name dictionary
            name_dict = stat_entry.get("name", {})
            
            # Create row with base metadata + flattened name fields + other stat fields
            row = {
                "model": model,
                "run": stats_path.parent.name,
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
    Merge instance-level data (instances, per_instance_stats, scenario_state) with run metadata.
    
    Args:
        report: Dictionary of DataFrames from create_comprehensive_report()
        
    Returns:
        Merged DataFrame with all instance-level information
    """
    instances_df = report["instances"].copy()
    per_instance_stats_df = report["per_instance_stats"].copy()
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
    
    # Add per_instance_stats (merge on run_id and instance_id)
    merged_df = merged_df.merge(
        per_instance_stats_df,
        on=["run_id", "instance_id"],
        how="left",
        suffixes=("", "_stat")
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






if __name__ == "__main__":
    print("Creating comprehensive report...")
    report = create_comprehensive_report()
    
    print("\nReport summary:")
    for name, df in report.items():
        print(f"  {name}: {len(df)} rows, {len(df.columns)} columns")
    
    print("\nCreating final merged dataframe with all data sources...")
    final_df = merge_instance_level_data(report)
    print(f"Final merged dataframe: {len(final_df)} rows, {len(final_df.columns)} columns")
    print(f"Columns: {list(final_df.columns)}")
    
    # This dataframe contains everything: scenario_state, instances, per_instance_stats, 
    # run_specs, and scenario_metadata all merged together