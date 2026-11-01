"""Explicit, silent native-iPhone diagnostic. Run on the USB-connected Mac."""

import argparse
import functools
import http.server
import json
from pathlib import Path
import statistics
import subprocess
import threading
import time
import urllib.error
import urllib.request


def assess(result):
    samples = result["samples"]

    def level(phase, sound, start, end):
        values = [s["rms"] for s in samples if s["phase"] == phase
                  and s["sound"] == sound and start <= s["ms"] <= end]
        if len(values) < 3:
            raise ValueError("Too few samples: %s/%s/%s-%s" % (phase, sound, start, end))
        return statistics.median(values)

    full = level("full-level", 0, 200, 550)
    half = level("half-level", 0, 200, 550)
    checks = {"nonSilentCalibration": 0.25 < full < 0.45,
              "halfVolume": 0.40 < half / max(full, 1e-9) < 0.60,
              "selectedExpectedPath": result["contextFactoryCalls"] == 1,
              "noPlaybackErrors": not result["errors"]}
    envelopes = {}
    for phase, sound in [("stop", 0), ("switch", 1), ("switch", 2), ("stop-incoming", 2)]:
        # Stop unloads A. Restart creates its new element (index 1), then B is 2.
        key = "%s/%s" % (phase, sound)
        values = [level(phase, sound, a, b) / max(full, 1e-9)
                  for a, b in [(350, 600), (850, 1100), (1650, 1850)]]
        envelopes[key] = values
        rising = phase == "switch" and sound == 2
        if rising:
            checks[key + "/ramp"] = (0.05 < values[0] < 0.45
                                      and 0.25 < values[1] < 0.75
                                      and 0.65 < values[2] < 1.1
                                      and values[0] < values[1] < values[2])
        else:
            checks[key + "/ramp"] = (0.55 < values[0] < 0.95
                                      and 0.25 < values[1] < 0.75
                                      and 0 < values[2] < 0.30
                                      and values[0] > values[1] > values[2])
            pauses = [s["ms"] for s in samples if s["phase"] == phase
                      and s["sound"] == sound and s["paused"]]
            checks[key + "/pauseTiming"] = bool(pauses) and 1850 <= min(pauses) <= 2300
        checks[key + "/activeBeforeEnd"] = all(
            not s["paused"] for s in samples if s["phase"] == phase
            and s["sound"] == sound and 300 <= s["ms"] <= 1800)
    return {"passed": all(checks.values()), "fullRms": full,
            "halfRatio": half / max(full, 1e-9), "envelopes": envelopes, "checks": checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device-id", required=True)
    parser.add_argument("--host", required=True, help="Mac LAN IP reachable from iPhone")
    parser.add_argument("--directory", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--http-port", default=49174, type=int)
    parser.add_argument("--driver-port", default=49173, type=int)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    if not (args.directory / "build.json").is_file():
        raise RuntimeError("Missing built diagnostic")

    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass

    server = http.server.ThreadingHTTPServer(
        (args.host, args.http_port), functools.partial(Handler, directory=str(args.directory)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    log = (args.output / "driver.log").open("w")
    driver = subprocess.Popen(["/usr/bin/safaridriver", "--port", str(args.driver_port)],
                              stdout=log, stderr=subprocess.STDOUT)
    sid = None
    summary = {"build": json.loads((args.directory / "build.json").read_text()),
               "outputAudioVerified": False, "runs": {}}

    def call(method, path, body=None):
        request = urllib.request.Request(
            "http://127.0.0.1:%d%s" % (args.driver_port, path),
            data=None if body is None else json.dumps(body).encode(),
            headers={"Content-Type": "application/json"}, method=method)
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                return json.load(response)["value"]
        except urllib.error.HTTPError as error:
            raise RuntimeError(error.read().decode()) from error

    def evaluate(script):
        return call("POST", "/session/" + sid + "/execute/sync", {"script": script, "args": []})

    def tap():
        point = evaluate("const r=document.getElementById('run').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};")
        call("POST", "/session/" + sid + "/actions", {"actions": [{
            "type": "pointer", "id": "device-tap", "parameters": {"pointerType": "touch"},
            "actions": [{"type": "pointerMove", "duration": 0, "origin": "viewport", **point},
                        {"type": "pointerDown", "button": 0}]}]})
        call("POST", "/session/" + sid + "/actions", {"actions": [{
            "type": "pointer", "id": "device-tap", "parameters": {"pointerType": "touch"},
            "actions": [{"type": "pointerUp", "button": 0}]}]})
        call("DELETE", "/session/" + sid + "/actions")

    try:
        for _ in range(30):
            if driver.poll() is not None:
                raise RuntimeError("Driver exited: " + (args.output / "driver.log").read_text())
            try:
                call("GET", "/status")
                break
            except urllib.error.URLError:
                time.sleep(0.2)
        session = call("POST", "/session", {"capabilities": {"alwaysMatch": {
            "browserName": "safari", "platformName": "ios", "safari:useSimulator": False,
            "safari:deviceUDID": args.device_id}}})
        sid = session["sessionId"]
        print("Selected physical device session", flush=True)
        caps = session["capabilities"]
        summary["capabilities"] = caps
        if (caps.get("safari:deviceUDID") != args.device_id
                or caps.get("safari:useSimulator") is not False
                or caps.get("platformName", "").lower() != "ios"):
            raise RuntimeError("Wrong device or simulator session")
        for mode in ["natural"]:
            call("POST", "/session/" + sid + "/url", {"url":
                 "http://%s:%d/?mode=%s" % (args.host, args.http_port, mode)})
            for _ in range(30):
                ready = evaluate("return {ready:window.deviceReady,error:window.deviceError};")
                if ready.get("error"):
                    raise RuntimeError(ready["error"])
                if ready.get("ready"):
                    break
                time.sleep(0.2)
            else:
                raise RuntimeError("Diagnostic script did not initialize")
            print(mode + ": diagnostic ready", flush=True)
            tap()
            time.sleep(0.5)
            tap_status = evaluate("return {disabled:document.getElementById('run').disabled,progress:window.deviceProgress,status:document.getElementById('status').textContent,events:window.deviceInputEvents};")
            print("Tap confirmed: " + str(tap_status["disabled"]), flush=True)
            (args.output / (mode + "-input.json")).write_text(json.dumps(tap_status, indent=2))
            if not evaluate("return document.getElementById('run').disabled;"):
                raise RuntimeError("WebDriver touch did not activate Start")
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                status = evaluate("return {result:window.deviceResult,error:window.deviceError,progress:window.deviceProgress,waiting:window.waitingForGesture};")
                (args.output / (mode + "-last-status.json")).write_text(json.dumps(status, indent=2))
                if status.get("error"):
                    raise RuntimeError(status["error"])
                if status.get("waiting"):
                    print(mode + ": tap " + status["waiting"], flush=True)
                    tap()
                if status.get("result"):
                    result = status["result"]
                    break
                time.sleep(0.5)
            else:
                raise TimeoutError("Device diagnostic did not complete")
            (args.output / (mode + ".json")).write_text(json.dumps(result, indent=2))
            summary["runs"][mode] = assess(result)
            print(mode + ": " + json.dumps(summary["runs"][mode]), flush=True)
    except Exception as error:
        summary["error"] = str(error)
        raise
    finally:
        if sid:
            try:
                call("DELETE", "/session/" + sid)
            except Exception as error:
                summary["cleanupError"] = str(error)
        driver.terminate()
        try:
            driver.wait(timeout=5)
        except subprocess.TimeoutExpired:
            driver.kill()
            driver.wait()
        log.close()
        server.shutdown()
        server.server_close()
        (args.output / "summary.json").write_text(json.dumps(summary, indent=2))
    return 0 if all(r["passed"] for r in summary["runs"].values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
