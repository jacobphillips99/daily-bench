# Pick any suite name of your choice
export SUITE_NAME=results-$(date +"%Y%m%d_%H%M%S")
# Note: HELM outputs to benchmark_output/runs/$SUITE_NAME by default
# The --suite parameter creates a subdirectory within benchmark_output/runs/

# Replace this with your model or models
export MODELS_TO_RUN="anthropic/claude-sonnet-4-20250514 openai/gpt-4o-mini-2024-07-18 openai/gpt-4.1-2025-04-14"
# export MODELS_TO_RUN="google/gemini-2.5-pro google/gemini-2.5-flash"

# Get these from the list below
export RUN_ENTRIES_CONF_PATH=run_entries_lite_20240424_instruct.conf
export SCHEMA_PATH=schema_lite.yaml
export NUM_TRAIN_TRIALS=1
export MAX_EVAL_INSTANCES=50
export PRIORITY=1

helm-run --conf-paths $RUN_ENTRIES_CONF_PATH --num-train-trials $NUM_TRAIN_TRIALS --max-eval-instances $MAX_EVAL_INSTANCES --priority $PRIORITY --suite $SUITE_NAME --models-to-run $MODELS_TO_RUN --disable-cache
helm-summarize --schema $SCHEMA_PATH --suite $SUITE_NAME
