r"""
========================================================================================
Design and Analysis of Algorithms (DAA) Project:
Optimized Wi-Fi Access Point Placement Using Greedy Maximum Coverage Algorithm
========================================================================================

Problem Definition:
    Given:
        - A set of classroom locations U = {r_1, r_2, ..., r_n} on a 2D floor plan.
        - A set of candidate Access Point (AP) locations C = {c_1, c_2, ..., c_m}.
        - A Wi-Fi transmission/coverage radius R.
        - A maximum budget of available Access Points K (K <= m).
    Goal:
        Select a subset S of at most K candidate APs from C that maximizes the total number
        of covered classrooms:
            Maximize | \bigcup_{c \in S} Cover(c) |  subject to |S| <= K
        where Cover(c) = { r \in U | euclidean_distance(c, r) <= R }.

Complexity Analysis:
    - Maximum Coverage is a classical NP-hard optimization problem.
    - The Greedy Algorithm achieves a guaranteed approximation ratio of (1 - 1/e) ≈ 63.2%
      of the optimal solution (Nemhauser et al., 1978).
    - Time Complexity: O(K * m * n)
        - K iterations (at most max_aps).
        - In each iteration, evaluate up to m candidates across n classrooms.
    - Space Complexity: O(m * n) to store candidate coverage sets and tracking structures.
========================================================================================
"""

import math
from typing import List, Dict, Any, Set, Tuple


def euclidean_distance(p1: Dict[str, float], p2: Dict[str, float]) -> float:
    """
    Calculates the Euclidean distance between two 2D points.
    Formula: sqrt((x2 - x1)^2 + (y2 - y1)^2)
    """
    dx = p1["x"] - p2["x"]
    dy = p1["y"] - p2["y"]
    return math.sqrt(dx * dx + dy * dy)


def generate_candidate_locations(
    classrooms: List[Dict[str, Any]],
    grid_step: int = 60,
    margin: int = 50,
    canvas_width: int = 900,
    canvas_height: int = 550,
    coverage_radius: float = 120.0
) -> List[Dict[str, Any]]:
    """
    Generates potential Access Point (AP) candidate locations.
    Strategies combined:
      1. Grid-based lattice across the floor bounding area.
      2. Classroom center coordinates (natural ceiling-mount positions).
      3. Pairwise midpoints between nearby classrooms (corridor / shared coverage).
    Candidates that cannot cover any classroom within 1.5 * radius are filtered out
    to avoid redundant computations.
    """
    if not classrooms:
        return []

    candidates_dict = {}  # Key: (round(x, 1), round(y, 1)) to prevent duplicates

    def add_candidate(x: float, y: float, source_type: str = "grid"):
        # Clamp to canvas boundaries
        clamped_x = max(20.0, min(float(canvas_width - 20), float(x)))
        clamped_y = max(20.0, min(float(canvas_height - 20), float(y)))
        key = (round(clamped_x / 10) * 10, round(clamped_y / 10) * 10)
        if key not in candidates_dict:
            candidates_dict[key] = {
                "id": f"CAND-{len(candidates_dict) + 1}",
                "x": key[0],
                "y": key[1],
                "type": source_type
            }

    # Bounding box of classrooms
    min_x = max(20, min(c["x"] for c in classrooms) - margin)
    max_x = min(canvas_width - 20, max(c["x"] for c in classrooms) + margin)
    min_y = max(20, min(c["y"] for c in classrooms) - margin)
    max_y = min(canvas_height - 20, max(c["y"] for c in classrooms) + margin)

    # 1. Grid sampling over bounding box
    curr_x = min_x
    while curr_x <= max_x:
        curr_y = min_y
        while curr_y <= max_y:
            add_candidate(curr_x, curr_y, "grid")
            curr_y += grid_step
        curr_x += grid_step

    # 2. Direct classroom locations
    for c in classrooms:
        add_candidate(c["x"], c["y"], "classroom_centric")

    # 3. Midpoints between nearby classrooms (within 2 * radius)
    n = len(classrooms)
    for i in range(n):
        for j in range(i + 1, n):
            c1 = classrooms[i]
            c2 = classrooms[j]
            d = euclidean_distance(c1, c2)
            if d <= coverage_radius * 1.8:
                mid_x = (c1["x"] + c2["x"]) / 2.0
                mid_y = (c1["y"] + c2["y"]) / 2.0
                add_candidate(mid_x, mid_y, "corridor_midpoint")

    candidate_list = list(candidates_dict.values())

    # Filter: retain candidates that can cover at least one classroom
    valid_candidates = []
    for cand in candidate_list:
        can_cover_any = any(
            euclidean_distance(cand, c) <= coverage_radius for c in classrooms
        )
        if can_cover_any:
            valid_candidates.append(cand)

    # If too few candidates survive, return raw candidates
    return valid_candidates if valid_candidates else candidate_list


def precompute_candidate_coverages(
    candidates: List[Dict[str, Any]],
    classrooms: List[Dict[str, Any]],
    coverage_radius: float
) -> Dict[str, Set[str]]:
    """
    Precomputes the set of classroom IDs covered by each candidate AP.
    Cover(c) = { room_id | distance(c, room) <= coverage_radius }
    """
    coverage_map: Dict[str, Set[str]] = {}
    for cand in candidates:
        covered = set()
        for room in classrooms:
            if euclidean_distance(cand, room) <= coverage_radius:
                covered.add(str(room["id"]))
        coverage_map[cand["id"]] = covered
    return coverage_map


def run_greedy_max_coverage(
    classrooms: List[Dict[str, Any]],
    candidate_aps: List[Dict[str, Any]],
    coverage_radius: float,
    max_aps: int
) -> Dict[str, Any]:
    """
    Executes the DAA Greedy Maximum Coverage Algorithm.

    Steps:
      1. Precompute the set of classrooms covered by each candidate AP.
      2. Initialize covered_classrooms = empty set.
      3. For iteration k = 1 to max_aps:
         a. Evaluate marginal gain of each unused candidate:
            gain(c) = | Cover(c) \\ covered_classrooms |
         b. Select candidate with maximum marginal gain.
         c. If max_gain == 0, terminate early (no more classrooms can be covered).
         d. Mark newly covered classrooms as covered.
         e. Record step details for visualization and viva explanation.
      4. Compute final performance metrics.
    """
    total_classrooms = len(classrooms)
    if total_classrooms == 0:
        return {
            "success": False,
            "message": "No classrooms provided on the floor plan.",
            "total_classrooms": 0,
            "aps_available": max_aps,
            "aps_used": 0,
            "covered_classrooms_count": 0,
            "uncovered_classrooms_count": 0,
            "coverage_percentage": 0.0,
            "selected_aps": [],
            "iterations": [],
            "covered_classroom_ids": [],
            "uncovered_classroom_ids": [],
            "candidate_count": 0
        }

    # If no candidates provided, auto-generate them
    if not candidate_aps:
        candidate_aps = generate_candidate_locations(
            classrooms=classrooms,
            grid_step=50,
            coverage_radius=coverage_radius
        )

    # Precompute coverage sets
    coverage_map = precompute_candidate_coverages(candidate_aps, classrooms, coverage_radius)
    candidates_by_id = {c["id"]: c for c in candidate_aps}
    classroom_name_map = {str(c["id"]): c.get("name", f"Room-{c['id']}") for c in classrooms}

    covered_classrooms: Set[str] = set()
    selected_aps: List[Dict[str, Any]] = []
    used_candidate_ids: Set[str] = set()
    iterations_log: List[Dict[str, Any]] = []

    # Greedy Iterations
    for step_num in range(1, max_aps + 1):
        if len(covered_classrooms) == total_classrooms:
            # All classrooms already covered!
            break

        best_candidate_id = None
        best_gain = -1
        best_new_rooms: Set[str] = set()

        # Greedy choice: pick candidate that covers the maximum number of UNCOVERED classrooms
        for cand_id, covered_set in coverage_map.items():
            if cand_id in used_candidate_ids:
                continue

            # Marginal gain = uncovered classrooms covered by this candidate
            uncovered_in_range = covered_set - covered_classrooms
            gain = len(uncovered_in_range)

            if gain > best_gain:
                best_gain = gain
                best_candidate_id = cand_id
                best_new_rooms = uncovered_in_range

        # If best gain is 0, no candidate can cover any more classrooms
        if best_gain <= 0 or best_candidate_id is None:
            break

        # Select the chosen AP
        chosen_cand = candidates_by_id[best_candidate_id]
        used_candidate_ids.add(best_candidate_id)
        covered_classrooms.update(best_new_rooms)

        ap_record = {
            "ap_id": f"AP-{step_num}",
            "candidate_id": best_candidate_id,
            "x": chosen_cand["x"],
            "y": chosen_cand["y"],
            "coverage_radius": coverage_radius,
            "marginal_gain": best_gain,
            "newly_covered_ids": list(best_new_rooms),
            "newly_covered_names": [classroom_name_map[rid] for rid in best_new_rooms],
            "total_covered_ids": list(coverage_map[best_candidate_id])
        }
        selected_aps.append(ap_record)

        cum_coverage_pct = round((len(covered_classrooms) / total_classrooms) * 100, 2)

        # Log iteration details
        iterations_log.append({
            "iteration": step_num,
            "ap_id": ap_record["ap_id"],
            "x": round(chosen_cand["x"], 1),
            "y": round(chosen_cand["y"], 1),
            "marginal_gain": best_gain,
            "newly_covered_names": ap_record["newly_covered_names"],
            "cumulative_covered": len(covered_classrooms),
            "total_classrooms": total_classrooms,
            "coverage_percentage": cum_coverage_pct,
            "explanation": (
                f"Iteration {step_num}: Placed {ap_record['ap_id']} at ({round(chosen_cand['x'])}, {round(chosen_cand['y'])}). "
                f"This location gave maximum marginal gain (+{best_gain} new classrooms: "
                f"{', '.join(ap_record['newly_covered_names']) or 'none'}). "
                f"Cumulative coverage reached {len(covered_classrooms)}/{total_classrooms} ({cum_coverage_pct}%)."
            )
        })

    # Summary metrics
    covered_ids_list = list(covered_classrooms)
    uncovered_ids_list = [str(r["id"]) for r in classrooms if str(r["id"]) not in covered_classrooms]
    final_coverage_pct = round((len(covered_ids_list) / total_classrooms) * 100, 2)

    return {
        "success": True,
        "total_classrooms": total_classrooms,
        "aps_available": max_aps,
        "aps_used": len(selected_aps),
        "covered_classrooms_count": len(covered_ids_list),
        "uncovered_classrooms_count": len(uncovered_ids_list),
        "coverage_percentage": final_coverage_pct,
        "selected_aps": selected_aps,
        "iterations": iterations_log,
        "covered_classroom_ids": covered_ids_list,
        "uncovered_classroom_ids": uncovered_ids_list,
        "candidate_count": len(candidate_aps)
    }


def get_sample_buildings() -> Dict[str, Any]:
    """
    Returns realistic sample floor plans representing academic campus buildings.
    """
    return {
        "engineering_l_shape": {
            "name": "Engineering Block (L-Shape Wing)",
            "description": "Standard engineering department with North wing and West wing classrooms around a central courtyard.",
            "recommended_aps": 4,
            "recommended_radius": 130,
            "classrooms": [
                # West Wing (vertical)
                {"id": "CR-101", "name": "CR-101", "x": 100, "y": 80, "type": "Lecture Hall"},
                {"id": "CR-102", "name": "CR-102", "x": 100, "y": 170, "type": "Lecture Hall"},
                {"id": "CR-103", "name": "CR-103", "x": 100, "y": 260, "type": "Smart Classroom"},
                {"id": "CR-104", "name": "CR-104", "x": 100, "y": 350, "type": "Smart Classroom"},
                {"id": "LAB-1", "name": "CAD Lab", "x": 100, "y": 450, "type": "Computer Lab"},

                # Corner Junction
                {"id": "CR-105", "name": "CR-105", "x": 200, "y": 450, "type": "Lecture Hall"},

                # South Wing (horizontal)
                {"id": "CR-106", "name": "CR-106", "x": 310, "y": 450, "type": "Lecture Hall"},
                {"id": "CR-107", "name": "CR-107", "x": 420, "y": 450, "type": "Seminar Room"},
                {"id": "LAB-2", "name": "IoT Lab", "x": 530, "y": 450, "type": "Hardware Lab"},
                {"id": "CR-108", "name": "CR-108", "x": 640, "y": 450, "type": "Lecture Hall"},
                {"id": "AUD", "name": "Mini Audi", "x": 750, "y": 450, "type": "Auditorium"},

                # North Parallel Row (Faculty & Tutorial)
                {"id": "CR-109", "name": "Tutorial 1", "x": 300, "y": 180, "type": "Tutorial Room"},
                {"id": "CR-110", "name": "Tutorial 2", "x": 450, "y": 180, "type": "Tutorial Room"},
                {"id": "LIB", "name": "Dept Library", "x": 600, "y": 180, "type": "Library"}
            ]
        },
        "cs_u_shape": {
            "name": "CS & AI Department (U-Shape Complex)",
            "description": "3 interconnected wings with labs, faculty cabins, and high-density student classrooms.",
            "recommended_aps": 5,
            "recommended_radius": 120,
            "classrooms": [
                # Left Wing
                {"id": "CS-1", "name": "AI Lab 1", "x": 120, "y": 100, "type": "Lab"},
                {"id": "CS-2", "name": "AI Lab 2", "x": 120, "y": 200, "type": "Lab"},
                {"id": "CS-3", "name": "Cloud Lab", "x": 120, "y": 300, "type": "Lab"},
                {"id": "CS-4", "name": "CR-201", "x": 120, "y": 420, "type": "Classroom"},

                # Bottom Wing
                {"id": "CS-5", "name": "CR-202", "x": 240, "y": 430, "type": "Classroom"},
                {"id": "CS-6", "name": "CR-203", "x": 360, "y": 430, "type": "Classroom"},
                {"id": "CS-7", "name": "CR-204", "x": 480, "y": 430, "type": "Classroom"},
                {"id": "CS-8", "name": "CR-205", "x": 600, "y": 430, "type": "Classroom"},
                {"id": "CS-9", "name": "CR-206", "x": 720, "y": 430, "type": "Classroom"},

                # Right Wing
                {"id": "CS-10", "name": "Data Sci Lab", "x": 720, "y": 310, "type": "Lab"},
                {"id": "CS-11", "name": "Cyber Lab", "x": 720, "y": 200, "type": "Lab"},
                {"id": "CS-12", "name": "Seminar Hall", "x": 720, "y": 100, "type": "Seminar"},

                # Central Island Classrooms
                {"id": "CS-13", "name": "Project Lab 1", "x": 340, "y": 220, "type": "Lab"},
                {"id": "CS-14", "name": "Project Lab 2", "x": 500, "y": 220, "type": "Lab"}
            ]
        },
        "campus_quad": {
            "name": "Academic Quad (4 Clusters)",
            "description": "Four distinct classroom clusters separated by wide walkways, challenging AP coverage distribution.",
            "recommended_aps": 4,
            "recommended_radius": 115,
            "classrooms": [
                # Cluster Northwest
                {"id": "NW-1", "name": "Room A1", "x": 150, "y": 100, "type": "Classroom"},
                {"id": "NW-2", "name": "Room A2", "x": 230, "y": 90, "type": "Classroom"},
                {"id": "NW-3", "name": "Room A3", "x": 160, "y": 180, "type": "Classroom"},
                {"id": "NW-4", "name": "Room A4", "x": 240, "y": 170, "type": "Classroom"},

                # Cluster Northeast
                {"id": "NE-1", "name": "Room B1", "x": 600, "y": 100, "type": "Classroom"},
                {"id": "NE-2", "name": "Room B2", "x": 690, "y": 110, "type": "Classroom"},
                {"id": "NE-3", "name": "Room B3", "x": 610, "y": 190, "type": "Classroom"},
                {"id": "NE-4", "name": "Room B4", "x": 700, "y": 180, "type": "Classroom"},

                # Cluster Southwest
                {"id": "SW-1", "name": "Room C1", "x": 150, "y": 360, "type": "Classroom"},
                {"id": "SW-2", "name": "Room C2", "x": 230, "y": 350, "type": "Classroom"},
                {"id": "SW-3", "name": "Room C3", "x": 160, "y": 440, "type": "Classroom"},
                {"id": "SW-4", "name": "Room C4", "x": 240, "y": 430, "type": "Classroom"},

                # Cluster Southeast
                {"id": "SE-1", "name": "Room D1", "x": 600, "y": 360, "type": "Classroom"},
                {"id": "SE-2", "name": "Room D2", "x": 690, "y": 350, "type": "Classroom"},
                {"id": "SE-3", "name": "Room D3", "x": 610, "y": 440, "type": "Classroom"},
                {"id": "SE-4", "name": "Room D4", "x": 700, "y": 430, "type": "Classroom"}
            ]
        }
    }
