#!/bin/bash
# Auto-claim and submit bounty when queue position becomes active
# Current claim expires ~22:49 UTC

BOUNTY_ID="d63ab72c-8019-4217-ada4-f0c4f30d8ab6"
WALLET_ADDRESS="0x7483a9F237cf8043704D6b17DA31c12BfFF860DD"
BACKEND="https://bounty-back-production.up.railway.app"
IPFS_CID="QmZEfYrhWz8sJyFtczTrfUhwVtc25B1sRekMzccVhv1xpi"
PRIVATE_KEY_FILE="/home/agent/credentials/wallet.json"
ETHERS_PATH="/home/agent/projects/chainlink-cre-x402/node_modules/ethers"
LOG="/home/agent/projects/startup-teardown-bot/auto-submit.log"

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "$LOG"
}

get_token() {
  local NONCE
  NONCE=$(curl -s "${BACKEND}/auth/nonce?address=${WALLET_ADDRESS}" | python3 -c "import json,sys; print(json.load(sys.stdin)['nonce'])")
  local PRIVATE_KEY
  PRIVATE_KEY=$(python3 -c "import json; print(json.load(open('${PRIVATE_KEY_FILE}'))['privateKey'])")

  local SIGNATURE
  SIGNATURE=$(node --input-type=module << EOF
import { ethers } from '${ETHERS_PATH}/lib.esm/index.js';
const wallet = new ethers.Wallet('${PRIVATE_KEY}');
const sig = await wallet.signMessage('${NONCE}');
console.log(sig);
EOF
)

  local TOKEN
  TOKEN=$(curl -s -X POST "${BACKEND}/auth/verify" \
    -H "Content-Type: application/json" \
    -d "{\"address\":\"${WALLET_ADDRESS}\",\"signature\":\"${SIGNATURE}\",\"nonce\":\"${NONCE}\"}" \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")

  echo "$TOKEN"
}

log "Auto-submit script started. Polling every 5 minutes..."
log "Target: claim bounty ${BOUNTY_ID} and submit CID ${IPFS_CID}"

while true; do
  # Check job status
  TOKEN=$(get_token)
  STATUS=$(curl -s "${BACKEND}/jobs/${BOUNTY_ID}" -H "Authorization: Bearer ${TOKEN}" | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','unknown'))")
  EXECUTOR=$(curl -s "${BACKEND}/jobs/${BOUNTY_ID}" -H "Authorization: Bearer ${TOKEN}" | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('executor_address','').lower())")

  log "Job status: ${STATUS}, Executor: ${EXECUTOR}"

  if [ "$STATUS" = "open" ] || [ "$STATUS" = "available" ]; then
    # Job is open - try to claim
    log "Job is open! Attempting to claim..."
    CLAIM_RESP=$(curl -s -X POST "${BACKEND}/jobs/${BOUNTY_ID}/claim" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d "{\"executorAddress\":\"${WALLET_ADDRESS}\"}")
    log "Claim response: ${CLAIM_RESP}"

    # Refresh token and submit
    sleep 2
    TOKEN=$(get_token)
    SUBMIT_RESP=$(curl -s -X POST "${BACKEND}/jobs/${BOUNTY_ID}/submit" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d "{\"outputCID\":\"${IPFS_CID}\"}")
    log "Submit response: ${SUBMIT_RESP}"
    log "DONE! Exiting."
    exit 0

  elif [ "$STATUS" = "claimed" ] && [ "$EXECUTOR" = "$(echo $WALLET_ADDRESS | tr '[:upper:]' '[:lower:]')" ]; then
    # WE are the claimant - submit immediately
    log "We are the active claimant! Submitting..."
    SUBMIT_RESP=$(curl -s -X POST "${BACKEND}/jobs/${BOUNTY_ID}/submit" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d "{\"outputCID\":\"${IPFS_CID}\"}")
    log "Submit response: ${SUBMIT_RESP}"
    log "DONE! Exiting."
    exit 0

  else
    log "Still waiting in queue... Will check again in 5 minutes."
    sleep 300
  fi
done
