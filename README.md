# Развертывание веб-приложения в Kubernetes

В этом проекте - учебный MVP для загрузки csv-файлов, запуска обучения модели, мониторинга с помощью Prometheus и Grafana. Все развернуто в Kubernetes.

## Установка Minikube и kubectl

```bash
curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube && rm minikube-linux-amd64


curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

## Развертывание

```bash
cp .env.example .env
uv sync --all-groups
docker build -t my-app:latest .
minikube start
eval $(minikube docker-env)
```

Делаем деплой приложения и сервисов:

```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f postgres.yaml
kubectl apply -f postgres-service.yaml
kubectl apply -f servicemonitor.yaml
```

Устанавливаем кол-во подов - 3:

```bash
kubectl scale deployment my-app-deployment --replicas=3
```

Ставим Metrics Server:

```bash
minikube addons enable metrics-server
```

Настраиваем масштабирование:

```bash
kubectl autoscale deployment my-app --cpu-percent=50 --min=2 --max=5
```

Прокинем порты:

```bash
kubectl port-forward deployment/my-app-deployment 8000:8000
kubectl port-forward svc/prometheus-grafana 3000:80
```

## В браузере

http://localhost:8000 - веб-приложение 

http://localhost:3000 - Grafana
