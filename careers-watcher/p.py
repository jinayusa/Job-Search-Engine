import requests, base64

# 1. Authentication
api_key = "YOUR_HARVEST_API_KEY"
auth_header = base64.b64encode(f"{api_key}:".encode()).decode()
headers = {"Authorization": f"Basic {auth_header}"}

# 2. API call
resp = requests.get("https://harvest.greenhouse.io/v1/jobs", headers=headers)

# 3. Parse response JSON instead of raw string
jobs = resp.json()   # this ensures jobs is a list of dicts

# 4. Filter open jobs
open_jobs = [job for job in jobs if job.get("status") == "open"]

# 5. Sort by updated_at
open_jobs.sort(key=lambda x: x.get("updated_at", ""), reverse=True)

# 6. Print latest job names
for job in open_jobs[:5]:  # top 5 newest jobs
    print(job["name"], job["updated_at"])
