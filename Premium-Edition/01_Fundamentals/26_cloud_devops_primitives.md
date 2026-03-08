# Part 26: Cloud Infrastructure & DevOps Primitives

System Design is not just about writing code; it's about how that code safely gets onto physical servers and how those servers are managed at scale. This is the domain of DevOps and Site Reliability Engineering (SRE).

---

## 🏗️ 1. Infrastructure as Code (IaC)

In the past, to set up a new database, a SysAdmin would log into the AWS Console, click a dozen buttons, type in a password, and manually provision an RDS instance. 
*   *The Problem:* This is called "ClickOps". It is unrepeatable, untestable, and impossible to recover quickly in a disaster. If the database gets deleted, nobody remembers exactly which 15 checkboxes were ticked 3 years ago.

**The Solution: IaC (Terraform, AWS CloudFormation)**
You write literal code to describe your physical infrastructure.

```hcl
# Example Terraform Code defining a Database
resource "aws_db_instance" "app_database" {
  allocated_storage    = 100
  storage_type         = "gp3" # NVMe SSD
  engine               = "postgres"
  engine_version       = "15.3"
  instance_class       = "db.r6g.large" # 16GB RAM, ARM CPU
  multi_az             = true # High Availability across data centers
  username             = "admin"
  password             = var.db_password
}
```

*   **Declarative vs. Imperative:** Terraform is *Declarative*. You do not write a script saying "Create a DB, wait 5 min, then create a subnet". You simply declare "I want my infrastructure to look exactly like this." Terraform talks to the AWS API, calculates the exact diff between reality and your code, and automatically issues the correct `CREATE`, `UPDATE`, or `DELETE` API calls to make reality match your code.
*   **The Benefit:** Your entire physical datacenter is now version-controlled in Git. You can deploy identical testing environments in 60 seconds (`terraform apply`).

---

## 🚀 2. Advanced Deployment Strategies

When you merge new code into `master`, how do you deploy it to 500 live servers without causing downtime or breaking the app for millions of users?

### Strategy A: Blue/Green Deployment
You want to deploy v2.0 of the app.
1.  **Preparation:** You spin up an entirely duplicate, identical environment of 500 servers (The "Green" environment) running v2.0. The live "Blue" environment is still serving 100% of user traffic on v1.0.
2.  **The Switch:** You update the main DNS router to point from Blue to Green. Traffic instantly flips to v2.0.
3.  **The Rollback:** If v2.0 crashes immediately, you flip the DNS router back to Blue. The rollback is instantaneous.
*   *Pros:* Zero downtime, instant rollback.
*   *Cons:* You have to pay AWS for 1,000 servers at the exact same time during the deployment. Highly expensive.

### Strategy B: Canary Releases
Named after "Canaries in the Coal Mine."
1.  You deploy v2.0 to exactly *one* server (1% of the fleet).
2.  The Load Balancer sends 1% of live user traffic to this Canary server.
3.  You monitor the ERROR metrics explicitly on the Canary. If the error rate spikes, you instantly kill the Canary and rollback. Only 1% of your users experienced a glitch.
4.  If the metrics look good for 30 minutes, you slowly roll out v2.0 to 10%, 25%, 50%, and 100% of the fleet over several hours.

### Strategy C: Shadow Testing (Dark Traffic)
The safest, most complex deployment possible.
1.  You deploy v2.0 to a hidden server.
2.  The Load Balancer sends 100% of normal traffic to the live v1.0 servers.
3.  *The Magic:* The Load Balancer *duplicates* the incoming HTTP request payload. It sends a silent, background copy of the request to the v2.0 shadow server.
4.  The shadow server actually processes the request, but its response is completely thrown away. The user never sees it. 
5.  Engineers compare the discarded v2.0 response against the live v1.0 response to ensure the new code behaves exactly as expected under real-world massive load without risking a single broken user interaction.

---

## ⚡ 3. Serverless Architecture (AWS Lambda / Google Cloud Functions)

Serverless is the ultimate abstraction of infrastructure. You do not provision servers, you do not manage operating systems, and you do not scale containers. You just write a single Python function, upload it to AWS, and AWS handles literally everything else.

### How it Works
1.  An event occurs (e.g., A user uploads an image to S3).
2.  AWS sees the event and instantly provisions a tiny, invisible micro-container running your Python function.
3.  The function executes, resizes the image, and then the micro-container is instantly destroyed.
4.  *Billing:* You are charged exclusively for the *compute milliseconds* your code was actually executing. If no one uploads an image for a week, you pay absolutely $0.00. 

### The Scaling Magic
If 100,000 distinct users upload an image at the exact same second, AWS instantly spins up 100,000 identical parallel copies of your Lambda function. It processes the entire viral spike in 1 second, and then scales back down to zero automatically. 

### The Achilles Heel: The "Cold Start"
Serverless is not perfect. 
*   If your Lambda function hasn't been executed in 15 minutes, AWS puts it to "sleep" (destroys the container) to save RAM.
*   When a new request arrives, AWS has to physically boot up a new container, load the Python runtime, load your dependencies (like Pandas or Numpy), and then execute the code.
*   This initialization process can take 2 to 5 seconds. This is a **Cold Start**. If your Lambda is behind an API Gateway responding to user clicks, a user occasionally experiencing a random 5-second latency spike is unacceptable UI design. (This is why high-volume, low-latency APIs are still written in persistent Docker containers, not Serverless Lambdas).
