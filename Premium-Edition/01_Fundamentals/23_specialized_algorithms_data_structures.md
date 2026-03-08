# Part 23: Specialized Algorithms & Data Structures

Every senior engineer must have a toolbox of specialized data structures. When standard SQL tables or HashMaps fail to scale, these are the mathematical primitives you must deploy in a System Design Interview.

---

## 🔠 1. Tries (Prefix Trees)

**The Problem:** You are building Google Autocomplete. A user types `"System D"`. You need to instantly search a database of 5 Billion past search queries and return the top 10 most popular suffixes (e.g., "System Design", "System Directory").
*   *SQL Failure:* `SELECT query FROM searches WHERE query LIKE 'System D%'` requires a massive index scan, taking hundreds of milliseconds. Autocomplete requires sub-10ms latency.

**The Solution: The Trie**
A Trie (pronounced "Try") is a tree-like data structure specifically optimized for string retrieval.
1.  **Structure:** The root node is empty. The children are individual characters. `S -> y -> s -> t -> e -> m`. 
2.  **Navigation:** When the user types `"Sys"`, you traverse down the tree to the `s` node in `O(L)` time (where L is the length of the string, e.g., 3 operations).
3.  **The Magic (Top-K caching):** From the `s` node, there might be 50,000 sub-branches. We do not traverse them all at runtime. Instead, every single node in the tree caches a hardcoded list of the "Top 10 Most Popular Queries" that flow through it.
4.  *Result:* Finding the autocomplete suggestions takes 3 microsecond operations. It is strictly limited by the length of the prefix, entirely independent of the 5 billion total queries in the system.

---

## 📊 2. Count-Min Sketch (Trending Topics)

**The Problem:** You are building Twitter. You need to calculate the "Top 10 Trending Hashtags" over the last hour. There are 100,000 tweets per second.
*   *HashMap Failure:* Keeping a `HashMap<String, Integer>` in RAM sounds easy (`hashmap.put("systemdesign", count + 1)`). But tracking 100 million unique, absurdly long hashtags takes hundreds of Gigabytes of RAM.

**The Solution: Count-Min Sketch**
A probabilistic data structure used for frequency estimation. It consumes almost zero memory regardless of the dataset size.
1.  **Structure:** It is a 2D matrix of integers (e.g., 5 rows, 1000 columns). All start at `0`.
2.  **Insertion (`#systemdesign`):** 
    *   You run the hashtag through 5 different, independent Hash Functions.
    *   Hash 1 says Column 450. You increment `Matrix[Row 1][Col 450] += 1`.
    *   Hash 2 says Column 812. You increment `Matrix[Row 2][Col 812] += 1`.
3.  **Frequency Query (`#systemdesign`):**
    *   You run the hashtag through the same 5 Hash Functions.
    *   You look at the integer values at those 5 locations.
    *   **The Magic:** You return the *Minimum* value of those 5 numbers.
4.  *Why it works:* Hash collisions are guaranteed to happen (someone else's hashtag might have incremented `Row 1, Col 450` too). By taking the minimum across 5 independent hashes, you strip away the collision noise.
*   *Tradeoffs:* It will never underestimate the count, but it might slightly overestimate it. (False positives are possible). It uses Megabytes of RAM instead of Terabytes.

---

## 🗺️ 3. Geohashing & Space-Filling Curves

**The Problem:** (Covered broadly in the Uber chapter, but the exact math is a common follow-up question). How do you actually convert a 2D map coordinate (Latitude: `37.77`, Longitude: `-122.41`) into a 1D string that a database can index?

**The Solution: Hilbert Curves / Z-Order Curves (Geohashing)**
1.  Imagine the globe as a flat square.
2.  Draw a line that snakes through every single sector of the square recursively (a fractal). This "unrolls" the 2D map into a single, massive 1-Dimensional continuous line.
3.  **The Magic Guarantee:** If two points are close to each other on the 2D map, they are mathematically extremely likely to be very close to each other on the 1D snake line.
4.  **Base32 Encoding:** We take the coordinates, intersect them, and convert them to binary, then to Base32 text.
    *   San Francisco = `9q8yy`
    *   Oakland = `9q8yw`
    *   New York = `dr5ru`
5.  *Result:* We can find drivers near John using a standard database index prefix search: `SELECT * FROM drivers WHERE location LIKE '9q8y%'`.

---

## ⏳ 4. Sliding Window Counters (Distributed Accuracy)

**The Problem:** We know *Sliding Window Logs* are perfectly accurate for Rate Limiting, but they use too much memory. We know *Fixed Window Counters* use zero memory, but they suffer from Boundary Spikes. 

**The Solution: Sliding Window Counter (The Hybrid Approximation)**
1.  You track the current minute's counter, and the *previous* minute's counter.
2.  *Scenario:* Limit is 100 requests per minute.
    *   At `01:00` (Previous Window), User sent 84 requests.
    *   At `01:01` (Current Window), User sent 36 requests.
3.  The User makes a new request at exactly `01:01:15` (25% of the way through the current minute).
4.  **The Magic Formula:** 
    `Calculated Count = (Previous Window Count * (1 - % of current window elapsed)) + Current Window Count`
    `Calculated Count = (84 * (1 - 0.25)) + 36`
    `Calculated Count = (84 * 0.75) + 36 = 63 + 36 = 99`.
5.  *Result:* The user is at 99 requests. They are allowed 1 more. We achieved 99% accuracy of a Sliding Log, using the tiny memory footprint of a Fixed Counter.
