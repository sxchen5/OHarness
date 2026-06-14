# Node 20 + Java 17 + Maven — Harness L1 沙箱镜像
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    openjdk-17-jdk-headless \
    maven \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

CMD ["bash", ".harness/scripts/verify-l1-inner.sh"]
