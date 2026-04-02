# Azure OpenAI Setup Guide for CustomERP

This is a step-by-step guide to set up Azure-hosted GPT models so your CustomERP AI agents (Distributor, HR, Invoice, Inventory, Integrator) each run on their own model deployment. Gemini stays configured as the emergency fallback.

Microsoft now manages all of this through **Azure AI Foundry** at [ai.azure.com](https://ai.azure.com).

---

## Prerequisites

- A Microsoft Azure account. If you don't have one, go to [https://azure.microsoft.com/free](https://azure.microsoft.com/free) and click **Start free** (you get $200 in credits for 30 days).
- A credit card (Azure requires one even for the free tier, but you won't be charged unless you exceed the free credits).

---

## Step 1: Sign in to Azure AI Foundry

1. Open your browser and go to [https://ai.azure.com](https://ai.azure.com).
2. Sign in with your Microsoft account.
3. Make sure the **New Foundry** toggle (top-right area) is turned **on**. If you see a "classic" label, click the toggle to switch to the new experience.

---

## Step 2: Create a Foundry Resource (Hub + Project)

A Foundry resource is the container that holds your AI deployments, keys, and usage data.

1. In the Foundry portal, click **Management** in the left sidebar, then **Resources**.
2. Click **+ New resource**.
3. Fill in:
   - **Subscription**: Select your Azure subscription.
   - **Resource group**: Click **Create new** and name it `custom-erp-ai` (or pick an existing one).
   - **Region**: Pick the region closest to you that has GPT-4o available. Good choices:
     - `East US` or `East US 2` (widest model availability, cheapest)
     - `Sweden Central` (good for Europe)
     - `Japan East` (good for Asia)
   - **Resource name**: `custom-erp-ai` (must be globally unique -- if taken, try `custom-erp-ai-123`).
4. Click **Create**. Wait for it to finish (1-2 minutes).
5. Once created, click into the resource. You'll see a **Project** was auto-created for you.

> **Note**: If you get a message about "requesting access" for OpenAI models, fill out the access request form linked on the page. Microsoft typically approves within 1-2 business days.

---

## Step 3: Deploy Your Models

You need to deploy **at least one model**. For the best setup, deploy separate models for each agent role.

1. In the Foundry portal, click **Discover** in the top navigation, then **Models** in the left sidebar.
2. Search for **gpt-4o** and click on it.
3. Click **Deploy** > **Custom settings**.
4. Fill in:
   - **Deployment name**: `gpt-4o` (for the simple setup) or `distributor-gpt4o` (for the advanced setup -- see below).
   - **Model version**: Use the latest available.
   - **Deployment type**: `Standard`.
   - **Tokens per Minute Rate Limit**: Start with `30K` (you can increase later).
5. Click **Deploy**.

### Simple Setup (1 deployment for everything)

Just deploy one `gpt-4o` deployment. All 5 agents will share it.

### Advanced Setup (separate deployment per agent)

This gives you the ability to fine-tune each agent independently in the future. Repeat the steps above for each:

| Deployment Name         | Model         | Why                             |
|------------------------|---------------|---------------------------------|
| `distributor-gpt4o`   | gpt-4o        | Routing agent -- needs accuracy |
| `hr-specialist`        | gpt-4o-mini   | HR domain -- cheaper model OK   |
| `invoice-specialist`   | gpt-4o-mini   | Invoice domain                  |
| `inventory-specialist` | gpt-4o-mini   | Inventory domain                |
| `integrator-gpt4o`    | gpt-4o        | Merging agent -- needs quality  |

To deploy gpt-4o-mini: go back to **Discover** > **Models**, search for **gpt-4o-mini**, click **Deploy** > **Custom settings**, and fill in the deployment name from the table above.

> **Tip**: gpt-4o-mini is significantly cheaper than gpt-4o and works well for domain-specific agents. Use gpt-4o for the Distributor and Integrator where accuracy matters more.

---

## Step 4: Get Your Endpoint and API Key

1. In the Foundry portal, click **Management** > **Resources** in the left sidebar.
2. Click on your resource (`custom-erp-ai`).
3. You'll see your resource details. Look for:
   - **Endpoint**: Something like `https://custom-erp-ai.openai.azure.com/` (this is the "OpenAI SDK" endpoint).
   - **Keys**: Click **Show keys** or go to the **Keys** section. You'll see **Key 1** and **Key 2**.
4. **Copy the endpoint and Key 1** -- you'll need them for the `.env` file.

**Alternative way to find the key**: Go to [portal.azure.com](https://portal.azure.com), search for your resource name (`custom-erp-ai`), click on it, then click **Keys and Endpoint** in the left sidebar.

> **Important**: Treat your API key like a password. Never share it or commit it to git.

---

## Step 5: Configure Your `.env` File

Open the file `platform/ai-gateway/.env` and set these values:

### Simple Setup (1 deployment)

```env
AI_DEFAULT_PROVIDER=azure_openai

AZURE_OPENAI_API_KEY=paste-your-key-1-here
AZURE_OPENAI_ENDPOINT=https://custom-erp-ai.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Keep Gemini as fallback
GOOGLE_AI_API_KEY=your-existing-gemini-key
```

### Advanced Setup (separate deployments)

```env
AI_DEFAULT_PROVIDER=azure_openai

AZURE_OPENAI_API_KEY=paste-your-key-1-here
AZURE_OPENAI_ENDPOINT=https://custom-erp-ai.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Per-agent deployment overrides
AI_AGENT_DISTRIBUTOR_AZURE_DEPLOYMENT=distributor-gpt4o
AI_AGENT_HR_AZURE_DEPLOYMENT=hr-specialist
AI_AGENT_INVOICE_AZURE_DEPLOYMENT=invoice-specialist
AI_AGENT_INVENTORY_AZURE_DEPLOYMENT=inventory-specialist
AI_AGENT_INTEGRATOR_AZURE_DEPLOYMENT=integrator-gpt4o

# Keep Gemini as fallback
GOOGLE_AI_API_KEY=your-existing-gemini-key
```

---

## Step 6: Install the Python Dependency

The Azure client uses the `openai` Python package. Run this in the `platform/ai-gateway` folder:

```bash
pip install openai>=1.40.0
```

Or if you use the requirements file:

```bash
pip install -r requirements.txt
```

---

## Step 7: Test the Connection

Start the AI Gateway and check the startup logs:

```bash
cd platform/ai-gateway
python -m uvicorn src.main:app --reload
```

You should see:

```
  CustomERP AI Gateway Starting...
  Default provider: azure_openai
  Azure OpenAI configured: True
  Google Gemini configured: True
  Configuration OK
```

Then test with the health endpoint:

```bash
curl http://localhost:8000/health
```

Should return `{"status": "ok"}`.

---

## Step 8: Monitor Usage and Costs

### In Azure AI Foundry

1. In the Foundry portal, click **Management** > **Resources** > your resource.
2. You can see deployment usage, token counts, and request metrics from the resource overview.

### In Azure Portal (for budgets)

1. Go to [portal.azure.com](https://portal.azure.com).
2. Navigate to your Resource Group (`custom-erp-ai`).
3. Click **Cost Management** > **Budgets** in the left sidebar.
4. Click **+ Add** and set a monthly budget (e.g., $50).
5. Configure email alerts at 50%, 80%, and 100% of budget.

---

## Step 9 (Future): Fine-Tuning Your Domain Models

Once you have enough data from real users, you can fine-tune models for each domain agent. This means the HR agent gets trained specifically on HR SDF generation, the Invoice agent on invoices, etc.

### 9a. Prepare Training Data

Create a JSONL file where each line is a training example. Each example has a system message, a user prompt, and the ideal assistant response:

```jsonl
{"messages": [{"role": "system", "content": "You are an HR module specialist for CustomERP."}, {"role": "user", "content": "Generate HR SDF for a bakery with 12 employees..."}, {"role": "assistant", "content": "{\"module\": \"hr\", \"entities\": [...], ...}"}]}
{"messages": [{"role": "system", "content": "You are an HR module specialist for CustomERP."}, {"role": "user", "content": "Generate HR SDF for a law firm..."}, {"role": "assistant", "content": "{\"module\": \"hr\", \"entities\": [...], ...}"}]}
```

You need at least **10 examples** per fine-tuning job, but **50-100+** examples will give much better results.

**Where to get examples**: Every time a user successfully generates an ERP, save the prompt and the final SDF output. Over time you'll build a dataset.

### 9b. Create a Fine-Tuning Job

1. In the Foundry portal, go to **Fine-tuning** in the left sidebar.
2. Click **+ Fine-tune model**.
3. Select the base model (e.g., `gpt-4o-mini`).
4. Upload your JSONL training file.
5. Optionally upload a validation file (10-20% of your training data).
6. Configure:
   - **Suffix**: `hr-specialist-v1` (to identify your fine-tuned model).
   - **Training epochs**: Start with 3 (Foundry will auto-suggest based on data size).
7. Click **Create** and wait for the job to finish (can take 30 minutes to several hours).

### 9c. Deploy the Fine-Tuned Model

1. Once fine-tuning completes, go to **Deployments** in the left sidebar.
2. Click **+ Deploy model** and select your fine-tuned model (it will appear with your suffix).
3. Deploy with a name like `hr-specialist-finetuned-v1`.

### 9d. Update Your `.env`

```env
AI_AGENT_HR_AZURE_DEPLOYMENT=hr-specialist-finetuned-v1
```

Restart the AI Gateway, and your HR agent will now use the fine-tuned model.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Azure OpenAI not configured" on startup | Check that `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT` are set in `.env` |
| "404 Not Found" errors | Make sure the deployment name in `.env` matches exactly what you created in Foundry |
| "429 Too Many Requests" | You hit the rate limit. Go to Foundry > Deployments and increase "Tokens per Minute" |
| "Access denied" / 401 errors | Double-check your API key in `.env`. Make sure you copied Key 1 |
| Models not available in your region | Some models are only in certain regions. `East US` has the widest availability |
| Can't find "Deploy" button | Make sure the "New Foundry" toggle is on at ai.azure.com |
| Fine-tuning not available | Fine-tuning is available for gpt-4o-mini. gpt-4o fine-tuning may require preview access |

---

## Cost Estimates

Rough pricing (check [Azure OpenAI pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) for current rates):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| gpt-4o | ~$2.50 | ~$10.00 |
| gpt-4o-mini | ~$0.15 | ~$0.60 |

A typical SDF generation pipeline uses ~5K-15K tokens total. At gpt-4o-mini rates, that's about **$0.01-$0.03 per generation**. Even at gpt-4o rates, it's about **$0.05-$0.15 per generation**.

For a small business generating 10-20 ERPs per month, expect **$1-$5/month** in AI costs.
