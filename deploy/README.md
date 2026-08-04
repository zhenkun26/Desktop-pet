# K8s 部署清单（参考模板）

> **重要边界说明**：本仓库当前交付物是 **Electron 桌面应用**（本地单用户、无 HTTP 服务端），
> 不能也不应直接部署进 Kubernetes。`/deploy` 下的清单是面向**未来服务端伴生 API**
> （如多端同步、消息推送网关）的**参考模板**，所有镜像、域名、密钥均为占位符。
> 在服务端组件落地前，请勿对桌面二进制执行 `kubectl apply`。

## 应用顺序

```bash
kubectl apply -f deploy/00-namespace.yaml
kubectl apply -f deploy/01-configmap.yaml
kubectl apply -f deploy/02-secret.yaml
kubectl apply -f deploy/03-deployment.yaml
kubectl apply -f deploy/04-service.yaml
kubectl apply -f deploy/05-ingress.yaml
kubectl apply -f deploy/06-hpa.yaml
kubectl apply -f deploy/07-pdb.yaml
```

## Secret 修改

```bash
kubectl -n hutao-pet create secret generic hutao-pet-secrets \
  --from-literal=DEEPSEEK_API_KEY='<YOUR_DEEPSEEK_API_KEY>' \
  --from-literal=DB_PASSWORD='<YOUR_DB_PASSWORD>' \
  --from-literal=JWT_SECRET='<YOUR_JWT_SECRET>' \
  --dry-run=client -o yaml | kubectl apply -f -
```

或直接编辑 Base64 占位符后重新 apply。

## 验证

```bash
kubectl -n hutao-pet get deploy,svc,hpa,pdb
kubectl -n hutao-pet rollout status deploy/hutao-pet-api
kubectl -n hutao-pet port-forward svc/hutao-pet-api 8080:80
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
```
