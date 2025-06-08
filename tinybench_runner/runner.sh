# Pick any suite name of your choice
export SUITE_NAME=results

# Replace this with your model or models
# export MODELS_TO_RUN=openai/gpt-4o-mini-2024-07-18
export MODELS_TO_RUN=openai/gpt-4o-2024-05-13

# Get these from the list below
export RUN_ENTRIES_CONF_PATH=run_entries_lite_20240424_instruct.conf
export SCHEMA_PATH=schema_lite.yaml
export NUM_TRAIN_TRIALS=1
export MAX_EVAL_INSTANCES=100
export PRIORITY=1

helm-run --conf-paths $RUN_ENTRIES_CONF_PATH --num-train-trials $NUM_TRAIN_TRIALS --max-eval-instances $MAX_EVAL_INSTANCES --priority $PRIORITY --suite $SUITE_NAME --models-to-run $MODELS_TO_RUN

helm-summarize --schema $SCHEMA_PATH --suite $SUITE_NAME

# helm-server --suite $SUITE_NAME