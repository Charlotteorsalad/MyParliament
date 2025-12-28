# 02_sampling: Core Hansard 500 Sampling & Flagging

This folder contains the scripts and outputs related to sampling 500 core Hansard documents for downstream model training and evaluation. The process involves two main stages: document flagging and stratified sampling.

--------------------------------------------------------

## Overview

**docsCat_flagging.ipynb**:  
Connects to the MongoDB collection `HansardDocument`.  
Flags all 3,816 documents based on:
- `scrapMethod` (PDF source method)
- `docLength` (length thresholds)
- `decade` (to ensure time diversity)  
Multithreaded processing is used for efficient metadata tagging.  
Output: `hansard_flagged_metadata.csv`

**stratifiedSampling.ipynb**:  
Loads the flagged metadata and applies stratified sampling logic.  
Ensures diversity across decades and balance of document lengths.  
Visualizes distribution using Plotly and Seaborn.  
Splits the selected 500 documents into:
- `hansard_core500_train.csv`
- `hansard_core500_test.csv`
- `hansard_core500_validation.csv`  
Also generates metadata and quality reports:
- `hansard_core500_final_metadata.csv`
- `hansard_core500_quality_report.csv`

-------------------------------------------------------------------

## File Descriptions

**docsCat_flagging.ipynb**:  
Flags Hansard documents with scrapMethod, docLength, and decade indicators.

**stratifiedSampling.ipynb**:  
Performs stratified sampling and dataset splitting.

**hansard_flagged_metadata.csv**:  
Intermediate output from flagging script.

**hansard_core500_final_metadata.csv**:  
Final list of 500 core documents selected for training.

**hansard_core500_quality_report.csv**:  
Summary report on content quality, diversity, and coverage.

**hansard_core500_train.csv**:  
Subset of training samples.

**hansard_core500_test.csv**:  
Subset of testing samples.

**hansard_core500_validation.csv**:  
Subset of validation samples.

-----------------------------------------------------------------------------------------

## Sampling Criteria

- Source: MongoDB collection `HansardDocument`
- Filters:
  - `processable = True`
  - `content_text.length > 500`
- Stratified by:
  - Decade (e.g. 1960s, 1970s, … 2020s)
  - Document length category
  - scrapMethod quality

----------------------------------------------------------------------------------------------------

## Notes

- All scripts in this folder were executed in Paperspace using Jupyter environment.
- Final CSV files are now moved to the local repo for consistent downstream processing.
- No documents were cleaned prior to sampling — cleaning will be performed after this step on the 500 sampled documents only.
