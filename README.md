# Optimized Wi-Fi Access Point Placement Using Greedy Maximum Coverage Algorithm

A full-stack Design and Analysis of Algorithms (DAA) project that formulates the spatial placement of Wi-Fi Access Points (APs) as the classical **Maximum Coverage Problem** and solves it using the **Greedy Choice Paradigm**.

---

## 📌 Problem Statement

Given:
* A set of classrooms with 2D spatial coordinates $U = \{r_1, r_2, \dots, r_n\}$ on a campus building floor plan.
* An Access Point transmission/coverage radius $R$.
* A limited hardware budget of at most $K$ Access Points ($K \le |C|$).
* Candidate mounting locations $C = \{c_1, c_2, \dots, c_m\}$.

**Objective:**
Select a subset $S \subseteq C$ of at most $K$ Access Points that maximizes the total number of classrooms covered:
$$\max_{S \subseteq C, |S| \le K} \left| \bigcup_{c \in S} \text{Cover}(c) \right|$$

where:
$$\text{Cover}(c) = \left\{ r \in U \mid \sqrt{(x_c - x_r)^2 + (y_c - y_r)^2} \le R \right\}$$

Coverage percentage is measured as:
$$\text{Coverage \%} = \left(\frac{\text{Covered Classrooms}}{\text{Total Classrooms}}\right) \times 100$$

---

## 💡 How the Greedy Algorithm Works

The algorithm follows the **Greedy Choice Property** by selecting the candidate AP location that yields the maximum *marginal gain* (covers the highest number of *currently uncovered* classrooms) at each step:

1. **Precompute Coverage Sets:** For every candidate AP location $c \in C$, calculate which classrooms fall within Euclidean distance $\le R$.
2. **Initialize:** An empty set of covered classrooms $\text{Covered} = \emptyset$ and chosen APs $S = \emptyset$.
3. **Iterative Greedy Selection (up to $K$ times):**
   * For every remaining candidate AP $c \in C \setminus S$, calculate:
     $$\text{Marginal Gain}(c) = |\text{Cover}(c) \setminus \text{Covered}|$$
   * Select candidate $c^*$ with the maximum marginal gain.
   * If $\text{Marginal Gain}(c^*) = 0$, break early (no further classrooms can be covered).
   * Add $c^*$ to $S$ and update $\text{Covered} \leftarrow \text{Covered} \cup \text{Cover}(c^*)$.
   * Record the iteration decision trace for step-by-step visual playback.
4. **Output:** Return the chosen AP coordinates, covered classrooms, uncovered classrooms, and coverage percentage.

---

## ⏱️ Complexity Analysis

### 1. Time Complexity: $O(K \cdot M \cdot N)$
* **Candidate generation / precomputation:** For $M$ candidates and $N$ classrooms, computing Euclidean distance takes $O(M \cdot N)$ time.
* **Greedy Loop:** Executes at most $K$ iterations. In each iteration, evaluating up to $M$ candidates across $N$ rooms takes $O(M \cdot N)$ time.
* **Total Time Complexity:** $\mathcal{O}(K \cdot M \cdot N)$ in the worst case, which executes in a few milliseconds on standard hardware.

### 2. Space Complexity: $O(M \cdot N)$
* **Coverage Matrix / Sets:** Storing which classrooms are covered by each of the $M$ candidates requires $O(M \cdot N)$ space.
* **Tracking Sets:** Sets for covered classrooms ($O(N)$) and selected APs ($O(K)$).
* **Total Space Complexity:** $\mathcal{O}(M \cdot N)$.

### 3. Approximation Ratio Guarantee: $(1 - 1/e) \approx 63.2\%$
Because the set coverage objective function is monotone and **submodular** (satisfies diminishing returns), Nemhauser et al. (1978) proved that the greedy heuristic guarantees at least $(1 - 1/e) \approx 63.2\%$ of the theoretical global optimum. In realistic spatial layouts, it routinely achieves 90%–98% coverage.

---

## 📁 Project Structure

```text
WIFI SOPT DAA PROJECT/
├── app.py                  # Flask server & REST API endpoints
├── algorithm.py            # Pure DAA Greedy Maximum Coverage algorithm
├── requirements.txt        # Python dependencies (Flask)
├── README.md               # Complete documentation & Viva guide
├── templates/
│   └── index.html          # HTML5 interactive UI with blueprint styling
└── static/
    ├── css/
    │   └── style.css       # Modern dark-mode expo-grade styling
    └── js/
        └── script.js       # Canvas rendering, drag & drop, animation
```

---

## 🚀 How to Run the Project

### Prerequisites
* Python 3.8 or above installed on your computer.

### Step 1: Install Dependencies
Open your terminal or command prompt in this project folder and run:
```bash
py -m pip install -r requirements.txt
```
*(Or `pip install -r requirements.txt` depending on your environment)*

### Step 2: Start the Flask Application
```bash
py app.py
```
*(Or `python app.py`)*

### Step 3: Open in Browser
Visit:
```text
http://127.0.0.1:5000
```

---

## 🎓 Viva Voce Preparation Guide (Top Q&A)

### Q1: What algorithm does this project use?
> **Answer:** "It uses the **Greedy Maximum Coverage Algorithm**. At each iteration, it selects the Access Point candidate that covers the maximum number of *currently uncovered* classrooms (maximum marginal gain)."

### Q2: Why is Greedy used instead of Brute Force or Dynamic Programming?
> **Answer:** "Maximum Coverage is an **NP-hard** optimization problem. A brute-force search over $\binom{M}{K}$ candidate combinations has exponential time complexity $O(M^K)$, which is intractable for large buildings. Dynamic Programming requires overlapping subproblems without spatial interdependencies, which does not hold here. The Greedy algorithm runs in fast polynomial time $O(K \cdot M \cdot N)$ and provides a proven $(1 - 1/e) \approx 63.2\%$ approximation ratio."

### Q3: What is the submodular property mentioned in the project?
> **Answer:** "A set function $f$ is submodular if adding an element to a smaller set yields at least as much increase as adding it to a larger set:
> $$f(A \cup \{x\}) - f(A) \ge f(B \cup \{x\}) - f(B) \quad \text{for } A \subseteq B$$
> This formalizes the concept of diminishing marginal returns: as more APs are placed, newly placed APs tend to cover fewer *new* classrooms."

### Q4: How are candidate AP locations generated?
> **Answer:** "We use three complementary strategies:
> 1. A uniform 2D grid/lattice over the floor plan bounding box.
> 2. Direct classroom center coordinates (ceiling mount positions).
> 3. Corridor midpoints between nearby pairs of classrooms (shared corridor coverage)."

### Q5: How is Euclidean distance calculated?
> **Answer:** "For an Access Point at $(x_1, y_1)$ and a classroom at $(x_2, y_2)$:
> $$\text{distance} = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$
> If $\text{distance} \le R$, the classroom is marked as covered."
