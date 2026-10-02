"""
========================================================================================
Flask Application Server:
Optimized Wi-Fi Access Point Placement Using Greedy Maximum Coverage Algorithm
========================================================================================
"""

from flask import Flask, render_template, request, jsonify
from algorithm import (
    run_greedy_max_coverage,
    generate_candidate_locations,
    get_sample_buildings,
    euclidean_distance
)
import random

app = Flask(__name__)


@app.route("/")
def index():
    """Renders the main interactive dashboard."""
    return render_template("index.html")


@app.route("/api/presets", methods=["GET"])
def api_presets():
    """Returns sample building floor plans with pre-configured classrooms."""
    presets = get_sample_buildings()
    return jsonify({"success": True, "presets": presets})


@app.route("/api/generate-candidates", methods=["POST"])
def api_generate_candidates():
    """
    Generates potential candidate Access Point locations based on classroom positions
    and the coverage radius.
    """
    try:
        data = request.get_json() or {}
        classrooms = data.get("classrooms", [])
        grid_step = int(data.get("grid_step", 50))
        radius = float(data.get("radius", 120))
        canvas_width = int(data.get("canvas_width", 900))
        canvas_height = int(data.get("canvas_height", 550))

        if not classrooms:
            return jsonify({
                "success": False,
                "message": "Cannot generate candidate APs without any classrooms."
            }), 400

        candidates = generate_candidate_locations(
            classrooms=classrooms,
            grid_step=grid_step,
            canvas_width=canvas_width,
            canvas_height=canvas_height,
            coverage_radius=radius
        )

        return jsonify({
            "success": True,
            "count": len(candidates),
            "candidates": candidates
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/optimize", methods=["POST"])
def api_optimize():
    """
    Runs the Greedy Maximum Coverage algorithm on the given classrooms and candidate APs.
    """
    try:
        data = request.get_json() or {}
        classrooms = data.get("classrooms", [])
        candidates = data.get("candidates", [])
        radius = float(data.get("radius", 120))
        max_aps = int(data.get("max_aps", 4))

        if not classrooms:
            return jsonify({
                "success": False,
                "message": "No classrooms defined. Please click on the floor plan to add classrooms or load a preset."
            }), 400

        if max_aps <= 0:
            return jsonify({
                "success": False,
                "message": "Number of APs must be at least 1."
            }), 400

        if radius <= 0:
            return jsonify({
                "success": False,
                "message": "Coverage radius must be greater than 0."
            }), 400

        # Execute Greedy Maximum Coverage
        result = run_greedy_max_coverage(
            classrooms=classrooms,
            candidate_aps=candidates,
            coverage_radius=radius,
            max_aps=max_aps
        )

        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/benchmark", methods=["POST"])
def api_benchmark():
    """
    Compares Greedy Maximum Coverage against Random Placement across multiple trials.
    Provides empirical validation of DAA algorithm superiority for Viva and Project Expo!
    """
    try:
        data = request.get_json() or {}
        classrooms = data.get("classrooms", [])
        candidates = data.get("candidates", [])
        radius = float(data.get("radius", 120))
        max_aps = int(data.get("max_aps", 4))

        if not classrooms:
            return jsonify({"success": False, "message": "No classrooms to benchmark."}), 400

        if not candidates:
            candidates = generate_candidate_locations(classrooms, coverage_radius=radius)

        # 1. Greedy Run
        greedy_res = run_greedy_max_coverage(classrooms, candidates, radius, max_aps)

        # 2. Random Placement (Average over 20 random trials)
        random_trials = 20
        random_coverage_sum = 0
        total_classrooms = len(classrooms)

        for _ in range(random_trials):
            if len(candidates) <= max_aps:
                chosen = candidates
            else:
                chosen = random.sample(candidates, max_aps)

            covered = set()
            for cand in chosen:
                for r in classrooms:
                    if euclidean_distance(cand, r) <= radius:
                        covered.add(r["id"])
            random_coverage_sum += len(covered)

        avg_random_covered = round(random_coverage_sum / random_trials, 1)
        avg_random_pct = round((avg_random_covered / total_classrooms) * 100, 2)

        return jsonify({
            "success": True,
            "total_classrooms": total_classrooms,
            "max_aps": max_aps,
            "greedy": {
                "covered_count": greedy_res["covered_classrooms_count"],
                "coverage_pct": greedy_res["coverage_percentage"]
            },
            "random_baseline": {
                "avg_covered_count": avg_random_covered,
                "coverage_pct": avg_random_pct,
                "trials": random_trials
            },
            "greedy_advantage_pct": round(greedy_res["coverage_percentage"] - avg_random_pct, 2)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    print("=" * 60)
    print(" DAA Project Server Starting...")
    print(" Open http://127.0.0.1:5000 in your web browser.")
    print("=" * 60)
    app.run(debug=True, port=5000)
