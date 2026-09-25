"""Send one captured reading to Rootera; contract example, not ESP32 firmware.

Set ROOTERA_API_URL, ROOTERA_DEVICE_ID and ROOTERA_DEVICE_TOKEN in the environment.
On retries preserve every CLI argument, especially message ID and observed time.
This script uses only Python's standard library and does not access sensor GPIO.
"""

import argparse
from datetime import datetime, timedelta, timezone
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen


def build_payload(args: argparse.Namespace) -> dict:
    if not 0 <= args.raw_adc <= 4095:
        raise ValueError("raw-adc must be an integer from 0 to 4095.")
    if args.calibration_version < 1:
        raise ValueError("calibration-version must be at least 1.")
    if not args.message_id.strip() or len(args.message_id) > 100:
        raise ValueError("message-id must contain 1 to 100 characters.")
    if not 0 <= args.signal_quality <= 1:
        raise ValueError("signal-quality must be between 0 and 1.")
    observed = datetime.fromisoformat(args.observed_at.replace("Z", "+00:00"))
    if observed.tzinfo is None or observed.utcoffset() is None:
        raise ValueError("observed-at requires Z or a timezone offset.")
    if observed > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise ValueError("observed-at cannot be more than five minutes in the future.")
    return {
        "message_id": args.message_id.strip(),
        "raw_adc": args.raw_adc,
        "calibration_version": args.calibration_version,
        "observed_at": observed.astimezone(timezone.utc).isoformat(),
        "signal_quality": args.signal_quality,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-adc", type=int, required=True)
    parser.add_argument("--calibration-version", type=int, required=True)
    parser.add_argument("--message-id", required=True)
    parser.add_argument("--observed-at", required=True)
    parser.add_argument("--signal-quality", type=float, default=1.0)
    args = parser.parse_args()
    try:
        body = build_payload(args)
        api_url = os.environ["ROOTERA_API_URL"].rstrip("/")
        device_id = os.environ["ROOTERA_DEVICE_ID"].strip()
        token = os.environ["ROOTERA_DEVICE_TOKEN"].strip()
        parsed = urlparse(api_url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("ROOTERA_API_URL must be an HTTP(S) URL.")
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("ROOTERA_API_URL must not contain credentials, a query or a fragment.")
        if not device_id or not token:
            raise ValueError("Device ID and device token cannot be empty.")
    except (KeyError, ValueError) as error:
        parser.error(str(error))

    request = Request(
        f"{api_url}/v1/devices/{quote(device_id, safe='')}/readings",
        data=json.dumps(body, allow_nan=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            result = json.loads(response.read().decode("utf-8"))
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return 0
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        print(f"HTTP {error.code}: {detail}", file=sys.stderr)
        print("Do not change the message ID to bypass validation or a conflict.", file=sys.stderr)
        return 1
    except (URLError, TimeoutError) as error:
        print(f"Transport error: {error.reason if isinstance(error, URLError) else 'timeout'}", file=sys.stderr)
        print("The save result is uncertain. Retry the same payload and message ID.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
