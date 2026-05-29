# Local Kind cluster quickstart

This is optional. Docker Compose runs without Kind. Use Kind only when you want the Kubernetes adapter to read real pod/deployment state.

```bash
kind create cluster --name aegisops

docker build -t aegisops-service:latest ../../services
kind load docker-image aegisops-service:latest --name aegisops

kubectl apply -f services.yaml
kubectl get pods
```

Run backend locally with Kubernetes adapter enabled:

```bash
cd ../../backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt

export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aegisops
export ENABLE_K8S_ADAPTER=true
export KUBECONFIG_PATH=$HOME/.kube/config
uvicorn app.main:app --reload --port 8000
```

Check adapter:

```bash
curl http://localhost:8000/kubernetes/payment-service/status
```
