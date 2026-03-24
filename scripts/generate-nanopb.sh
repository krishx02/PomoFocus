#!/usr/bin/env bash
# Generate Nanopb C code from pomofocus.proto for firmware.
# Outputs pomofocus.pb.h and pomofocus.pb.c to firmware/device/lib/proto/.
# Requires: nanopb Python package (pip install nanopb)
# See ADR-013 (.proto as single source of truth) and ADR-015 (Nanopb toolchain).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PROTO_DIR="${REPO_ROOT}/packages/ble-protocol/proto"
PROTO_FILE="${PROTO_DIR}/pomofocus.proto"
OPTIONS_FILE="${PROTO_DIR}/pomofocus.options"
OUT_DIR="${REPO_ROOT}/firmware/device/lib/proto"

# Validate inputs exist
if [ ! -f "${PROTO_FILE}" ]; then
  echo "ERROR: Proto file not found: ${PROTO_FILE}" >&2
  exit 1
fi

if [ ! -f "${OPTIONS_FILE}" ]; then
  echo "ERROR: Options file not found: ${OPTIONS_FILE}" >&2
  exit 1
fi

# Find nanopb_generator — check PATH first, then common pip install locations
NANOPB_GEN=""
if command -v nanopb_generator &>/dev/null; then
  NANOPB_GEN="nanopb_generator"
else
  # Check common pip --user install paths (macOS / Linux)
  for candidate in \
    "${HOME}/Library/Python/3.9/bin/nanopb_generator" \
    "${HOME}/.local/bin/nanopb_generator" \
    "${HOME}/Library/Python/3.11/bin/nanopb_generator" \
    "${HOME}/Library/Python/3.12/bin/nanopb_generator" \
    "${HOME}/Library/Python/3.10/bin/nanopb_generator"; do
    if [ -x "${candidate}" ]; then
      NANOPB_GEN="${candidate}"
      break
    fi
  done
fi

if [ -z "${NANOPB_GEN}" ]; then
  echo "ERROR: nanopb_generator not found. Install with: pip install nanopb" >&2
  exit 1
fi

# Ensure output directory exists
mkdir -p "${OUT_DIR}"

echo "Generating Nanopb C code..."
echo "  Proto:   ${PROTO_FILE}"
echo "  Options: ${OPTIONS_FILE}"
echo "  Output:  ${OUT_DIR}"

# Run nanopb_generator.
# --options-path: directory containing .options file
# -D: output directory for generated files
"${NANOPB_GEN}" \
  --options-path="${PROTO_DIR}" \
  -D "${OUT_DIR}" \
  "${PROTO_FILE}"

# Verify output files were created
if [ ! -f "${OUT_DIR}/pomofocus.pb.h" ] || [ ! -f "${OUT_DIR}/pomofocus.pb.c" ]; then
  echo "ERROR: Generation failed — expected output files not found in ${OUT_DIR}" >&2
  exit 1
fi

echo "Generated:"
echo "  ${OUT_DIR}/pomofocus.pb.h"
echo "  ${OUT_DIR}/pomofocus.pb.c"
echo "Done."
