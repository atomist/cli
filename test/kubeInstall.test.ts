/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { K8sObject } from "@atomist/sdm-pack-k8s/lib/kubernetes/api";
import * as assert from "power-assert";
import {
    applySpec,
    encodeSecret,
    fetchSpecs,
    k8sSdmConfig,
    kubeWebhookUrls,
    processSpecs,
    specSlug,
} from "../lib/kubeInstall";
import * as print from "../lib/print";

/* tslint:disable:max-file-line-count */

describe("kubeInstall", () => {

    describe("encodeSecret", () => {

        it("should encode a secret value", () => {
            const s = {
                "yo-la-tengo": `{"albums":["Ride the Tiger","New Wave Hot Dogs","President Yo La Tengo","Fakebook"]}`,
            };
            const k = encodeSecret("ylt", "matador", s);
            const e = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                metadata: {
                    name: "ylt",
                    namespace: "matador",
                },
                data: {
                    // tslint:disable-next-line:max-line-length
                    "yo-la-tengo": "eyJhbGJ1bXMiOlsiUmlkZSB0aGUgVGlnZXIiLCJOZXcgV2F2ZSBIb3QgRG9ncyIsIlByZXNpZGVudCBZbyBMYSBUZW5nbyIsIkZha2Vib29rIl19",
                },
            };
            assert.deepStrictEqual(k, e);
        });

        it("should encode a few secret values", () => {
            const s = {
                "yo-la-tengo": `{"albums":["Ride the Tiger","New Wave Hot Dogs","President Yo La Tengo","Fakebook"]}`,
                "brokenSocialScene": "A Canadian musical collective.\n",
            };
            const k = encodeSecret("feel", "bar-none", s);
            const e = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                metadata: {
                    name: "feel",
                    namespace: "bar-none",
                },
                data: {
                    // tslint:disable-next-line:max-line-length
                    "yo-la-tengo": "eyJhbGJ1bXMiOlsiUmlkZSB0aGUgVGlnZXIiLCJOZXcgV2F2ZSBIb3QgRG9ncyIsIlByZXNpZGVudCBZbyBMYSBUZW5nbyIsIkZha2Vib29rIl19",
                    "brokenSocialScene": "QSBDYW5hZGlhbiBtdXNpY2FsIGNvbGxlY3RpdmUuCg==",
                },
            };
            assert.deepStrictEqual(k, e);
        });

        it("should create an empty data secret", () => {
            const s = {};
            const k = encodeSecret("nada", "nil", s);
            const e = {
                apiVersion: "v1",
                kind: "Secret",
                type: "Opaque",
                metadata: {
                    name: "nada",
                    namespace: "nil",
                },
                data: {},
            };
            assert.deepStrictEqual(k, e);
        });

    });

    describe("k8sSdmConfig", () => {

        it("should return the default config", () => {
            const o = {
                apiKey: "THEFLYINGBURRITOBROTHERSWILDHORSES",
                environment: "burrito-deluxe",
                workspaceIds: ["A1234567"],
            };
            const c = k8sSdmConfig(o);
            const e = {
                apiKey: "THEFLYINGBURRITOBROTHERSWILDHORSES",
                environment: "burrito-deluxe",
                logging: {
                    level: "debug",
                },
                name: "@atomist/k8s-sdm_burrito-deluxe",
                sdm: {
                    k8s: {
                        options: {
                            addCommands: true,
                            registerCluster: true,
                        },
                    },
                    kubernetes: {
                        provider: {
                            url: undefined as string,
                        },
                    },
                },
                workspaceIds: ["A1234567"],
            };
            assert.deepStrictEqual(c, e);
        });

        it("should support multiple workspaces", () => {
            const o = {
                apiKey: "THEFLYINGBURRITOBROTHERSWILDHORSES",
                environment: "burrito-deluxe",
                workspaceIds: ["A1234567", "A0987654", "A1029384"],
            };
            const c = k8sSdmConfig(o);
            const e = {
                apiKey: "THEFLYINGBURRITOBROTHERSWILDHORSES",
                environment: "burrito-deluxe",
                logging: {
                    level: "debug",
                },
                name: "@atomist/k8s-sdm_burrito-deluxe",
                sdm: {
                    k8s: {
                        options: {
                            addCommands: true,
                            registerCluster: true,
                        },
                    },
                    kubernetes: {
                        provider: {
                            url: undefined as string,
                        },
                    },
                },
                workspaceIds: ["A1234567", "A0987654", "A1029384"],
            };
            assert.deepStrictEqual(c, e);
        });

        it("should return the config with url", () => {
            const o = {
                apiKey: "THEFLYINGBURRITOBROTHERSWILDHORSES",
                environment: "burrito-deluxe",
                workspaceIds: ["A1234567"],
                url: "https://burrito.kuberneties.io/api",
            };
            const c = k8sSdmConfig(o);
            const e = {
                apiKey: "THEFLYINGBURRITOBROTHERSWILDHORSES",
                environment: "burrito-deluxe",
                logging: {
                    level: "debug",
                },
                name: "@atomist/k8s-sdm_burrito-deluxe",
                sdm: {
                    k8s: {
                        options: {
                            addCommands: true,
                            registerCluster: true,
                        },
                    },
                    kubernetes: {
                        provider: {
                            url: "https://burrito.kuberneties.io/api",
                        },
                    },
                },
                workspaceIds: ["A1234567"],
            };
            assert.deepStrictEqual(c, e);
        });

    });

    describe("kubeWebhookUrls", () => {

        it("should return a single URL", () => {
            const w = ["A1234567"];
            const u = kubeWebhookUrls(w);
            const e = "https://webhook.atomist.com/atomist/kube/teams/A1234567";
            assert(u === e);
        });

        it("should return multiple URLs", () => {
            const w = ["A1234567", "A0987654", "A1029384"];
            const u = kubeWebhookUrls(w);
            // tslint:disable-next-line:max-line-length
            const e = "https://webhook.atomist.com/atomist/kube/teams/A1234567,https://webhook.atomist.com/atomist/kube/teams/A0987654,https://webhook.atomist.com/atomist/kube/teams/A1029384";
            assert(u === e);
        });

        it("should return no URLs", () => {
            const w: string[] = [];
            const u = kubeWebhookUrls(w);
            const e = "";
            assert(u === e);
        });

    });

    describe("processSpecs", () => {

        it("should return the parsed specs", () => {
            const r = `apiVersion: v1
kind: Namespace
metadata:
  labels:
    app.kubernetes.io/managed-by: atomist
    app.kubernetes.io/name: sdm
    app.kubernetes.io/part-of: sdm
  name: sdm
---
apiVersion: v1
kind: ServiceAccount
metadata:
  labels:
    app.kubernetes.io/managed-by: atomist
    app.kubernetes.io/name: k8s-sdm
    app.kubernetes.io/part-of: k8s-sdm
    atomist.com/workspaceId: T29E48P34
  name: k8s-sdm
  namespace: sdm
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  labels:
    app.kubernetes.io/managed-by: atomist
    app.kubernetes.io/name: k8s-sdm
    app.kubernetes.io/part-of: k8s-sdm
    atomist.com/workspaceId: T29E48P34
  name: k8s-sdm
rules:
  - apiGroups: [""]
    resources: ["namespaces", "pods", "secrets", "serviceaccounts", "services"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["apps", "extensions"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["extensions", "networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["rbac.authorization.k8s.io"]
    resources: ["clusterroles", "clusterrolebindings", "roles", "rolebindings"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  labels:
    app.kubernetes.io/managed-by: atomist
    app.kubernetes.io/name: k8s-sdm
    app.kubernetes.io/part-of: k8s-sdm
    atomist.com/workspaceId: T29E48P34
  name: k8s-sdm
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: k8s-sdm
subjects:
  - kind: ServiceAccount
    name: k8s-sdm
    namespace: sdm
---
kind: Deployment
apiVersion: apps/v1
metadata:
  labels:
    app.kubernetes.io/managed-by: atomist
    app.kubernetes.io/name: k8s-sdm
    app.kubernetes.io/part-of: k8s-sdm
    atomist.com/workspaceId: T29E48P34
  name: k8s-sdm
  namespace: sdm
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: k8s-sdm
      atomist.com/workspaceId: T29E48P34
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/managed-by: atomist
        app.kubernetes.io/name: k8s-sdm
        app.kubernetes.io/part-of: k8s-sdm
        app.kubernetes.io/version: "1"
        atomist.com/workspaceId: T29E48P34
    spec:
      containers:
        - env:
            - name: ATOMIST_CONFIG_PATH
              value: /opt/atm/client.config.json
            - name: TMPDIR
              value: /tmp
          image: atomist/k8s-sdm:1.5.0
          livenessProbe:
            failureThreshold: 3
            httpGet:
              path: /health
              port: http
              scheme: HTTP
            initialDelaySeconds: 20
            periodSeconds: 20
            successThreshold: 1
            timeoutSeconds: 3
          name: k8s-sdm
          ports:
            - name: http
              containerPort: 2866
              protocol: TCP
          readinessProbe:
            failureThreshold: 3
            httpGet:
              path: /health
              port: http
              scheme: HTTP
            initialDelaySeconds: 20
            periodSeconds: 20
            successThreshold: 1
            timeoutSeconds: 3
          resources:
            limits:
              cpu: 500m
              memory: 768Mi
            requests:
              cpu: 100m
              memory: 512Mi
          securityContext:
            allowPrivilegeEscalation: false
            privileged: false
            readOnlyRootFilesystem: true
          volumeMounts:
            - mountPath: /opt/atm
              name: k8s-sdm
              readOnly: true
            - mountPath: /home/atomist
              name: home
            - mountPath: /tmp
              name: tmp
      initContainers:
        - args:
            - git config --global user.email 'bot@atomist.com' && git config --global user.name 'Atomist Bot'
          command: ["/bin/sh", "-c"]
          image: atomist/sdm-base:0.3.0
          name: "home"
          securityContext:
            allowPrivilegeEscalation: false
            privileged: false
            readOnlyRootFilesystem: true
          volumeMounts:
            - mountPath: /home/atomist
              name: home
      securityContext:
        fsGroup: 2866
        runAsGroup: 2866
        runAsNonRoot: true
        runAsUser: 2866
        supplementalGroups: []
        sysctls: []
      serviceAccountName: k8s-sdm
      volumes:
        - name: k8s-sdm
          secret:
            defaultMode: 288
            secretName: k8s-sdm
        - emptyDir: {}
          name: home
        - emptyDir: {}
          name: tmp
`;
            const s = processSpecs(r);
            const e: any[] = [
                {
                    apiVersion: "v1",
                    kind: "Namespace",
                    metadata: {
                        labels: {
                            "app.kubernetes.io/managed-by": "atomist",
                            "app.kubernetes.io/name": "sdm",
                            "app.kubernetes.io/part-of": "sdm",
                        },
                        name: "sdm",
                    },
                },
                {
                    apiVersion: "v1",
                    kind: "ServiceAccount",
                    metadata: {
                        labels: {
                            "app.kubernetes.io/managed-by": "atomist",
                            "app.kubernetes.io/name": "k8s-sdm",
                            "app.kubernetes.io/part-of": "k8s-sdm",
                            "atomist.com/workspaceId": "T29E48P34",
                        },
                        name: "k8s-sdm",
                        namespace: "sdm",
                    },
                },
                {
                    apiVersion: "rbac.authorization.k8s.io/v1",
                    kind: "ClusterRole",
                    metadata: {
                        labels: {
                            "app.kubernetes.io/managed-by": "atomist",
                            "app.kubernetes.io/name": "k8s-sdm",
                            "app.kubernetes.io/part-of": "k8s-sdm",
                            "atomist.com/workspaceId": "T29E48P34",
                        },
                        name: "k8s-sdm",
                    },
                    rules: [
                        {
                            apiGroups: [""],
                            resources: ["namespaces", "pods", "secrets", "serviceaccounts", "services"],
                            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
                        },
                        {
                            apiGroups: ["apps", "extensions"],
                            resources: ["deployments"],
                            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
                        },
                        {
                            apiGroups: ["extensions", "networking.k8s.io"],
                            resources: ["ingresses"],
                            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
                        },
                        {
                            apiGroups: ["rbac.authorization.k8s.io"],
                            resources: ["clusterroles", "clusterrolebindings", "roles", "rolebindings"],
                            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
                        },
                    ],
                },
                {
                    apiVersion: "rbac.authorization.k8s.io/v1",
                    kind: "ClusterRoleBinding",
                    metadata: {
                        labels: {
                            "app.kubernetes.io/managed-by": "atomist",
                            "app.kubernetes.io/name": "k8s-sdm",
                            "app.kubernetes.io/part-of": "k8s-sdm",
                            "atomist.com/workspaceId": "T29E48P34",
                        },
                        name: "k8s-sdm",
                    },
                    roleRef: {
                        apiGroup: "rbac.authorization.k8s.io",
                        kind: "ClusterRole",
                        name: "k8s-sdm",
                    },
                    subjects: [
                        {
                            kind: "ServiceAccount",
                            name: "k8s-sdm",
                            namespace: "sdm",
                        },
                    ],
                },
                {
                    apiVersion: "apps/v1",
                    kind: "Deployment",
                    metadata: {
                        labels: {
                            "app.kubernetes.io/managed-by": "atomist",
                            "app.kubernetes.io/name": "k8s-sdm",
                            "app.kubernetes.io/part-of": "k8s-sdm",
                            "atomist.com/workspaceId": "T29E48P34",
                        },
                        name: "k8s-sdm",
                        namespace: "sdm",
                    },
                    spec: {
                        replicas: 1,
                        selector: {
                            matchLabels: {
                                "app.kubernetes.io/name": "k8s-sdm",
                                "atomist.com/workspaceId": "T29E48P34",
                            },
                        },
                        strategy: {
                            rollingUpdate: {
                                maxSurge: 1,
                                maxUnavailable: 0,
                            },
                            type: "RollingUpdate",
                        },
                        template: {
                            metadata: {
                                labels: {
                                    "app.kubernetes.io/managed-by": "atomist",
                                    "app.kubernetes.io/name": "k8s-sdm",
                                    "app.kubernetes.io/part-of": "k8s-sdm",
                                    "app.kubernetes.io/version": "1",
                                    "atomist.com/workspaceId": "T29E48P34",
                                },
                            },
                            spec: {
                                containers: [
                                    {
                                        env: [
                                            {
                                                name: "ATOMIST_CONFIG_PATH",
                                                value: "/opt/atm/client.config.json",
                                            },
                                            {
                                                name: "TMPDIR",
                                                value: "/tmp",
                                            },
                                        ],
                                        image: "atomist/k8s-sdm:1.5.0",
                                        livenessProbe: {
                                            failureThreshold: 3,
                                            httpGet: {
                                                path: "/health",
                                                port: "http",
                                                scheme: "HTTP",
                                            },
                                            initialDelaySeconds: 20,
                                            periodSeconds: 20,
                                            successThreshold: 1,
                                            timeoutSeconds: 3,
                                        },
                                        name: "k8s-sdm",
                                        ports: [
                                            {
                                                containerPort: 2866,
                                                name: "http",
                                                protocol: "TCP",
                                            },
                                        ],
                                        readinessProbe: {
                                            failureThreshold: 3,
                                            httpGet: {
                                                path: "/health",
                                                port: "http",
                                                scheme: "HTTP",
                                            },
                                            initialDelaySeconds: 20,
                                            periodSeconds: 20,
                                            successThreshold: 1,
                                            timeoutSeconds: 3,
                                        },
                                        resources: {
                                            limits: {
                                                cpu: "500m",
                                                memory: "768Mi",
                                            },
                                            requests: {
                                                cpu: "100m",
                                                memory: "512Mi",
                                            },
                                        },
                                        securityContext: {
                                            allowPrivilegeEscalation: false,
                                            privileged: false,
                                            readOnlyRootFilesystem: true,
                                        },
                                        volumeMounts: [
                                            {
                                                mountPath: "/opt/atm",
                                                name: "k8s-sdm",
                                                readOnly: true,
                                            },
                                            {
                                                mountPath: "/home/atomist",
                                                name: "home",
                                            },
                                            {
                                                mountPath: "/tmp",
                                                name: "tmp",
                                            },
                                        ],
                                    },
                                ],
                                initContainers: [
                                    {
                                        args: [
                                            "git config --global user.email 'bot@atomist.com' && git config --global user.name 'Atomist Bot'",
                                        ],
                                        command: [
                                            "/bin/sh",
                                            "-c",
                                        ],
                                        image: "atomist/sdm-base:0.3.0",
                                        name: "home",
                                        securityContext: {
                                            allowPrivilegeEscalation: false,
                                            privileged: false,
                                            readOnlyRootFilesystem: true,
                                        },
                                        volumeMounts: [
                                            {
                                                mountPath: "/home/atomist",
                                                name: "home",
                                            },
                                        ],
                                    },
                                ],
                                securityContext: {
                                    fsGroup: 2866,
                                    runAsGroup: 2866,
                                    runAsNonRoot: true,
                                    runAsUser: 2866,
                                    supplementalGroups: [],
                                    sysctls: [],
                                },
                                serviceAccountName: "k8s-sdm",
                                volumes: [
                                    {
                                        name: "k8s-sdm",
                                        secret: {
                                            defaultMode: 288,
                                            secretName: "k8s-sdm",
                                        },
                                    },
                                    {
                                        emptyDir: {},
                                        name: "home",
                                    },
                                    {
                                        emptyDir: {},
                                        name: "tmp",
                                    },
                                ],
                            },
                        },
                    },
                },
            ];
            assert.deepStrictEqual(s, e);
        });

        it("should add the namespace to the specs", () => {
            const r = `apiVersion: v1
kind: ServiceAccount
metadata:
  labels:
    app.kubernetes.io/managed-by: atomist
    app.kubernetes.io/name: k8s-sdm
    app.kubernetes.io/part-of: k8s-sdm
    atomist.com/workspaceId: T29E48P34
  name: k8s-sdm
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  labels:
    app.kubernetes.io/managed-by: atomist
    app.kubernetes.io/name: k8s-sdm
    app.kubernetes.io/part-of: k8s-sdm
    atomist.com/workspaceId: T29E48P34
  name: k8s-sdm
rules:
  - apiGroups: [""]
    resources: ["pods", "secrets", "serviceaccounts", "services"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["apps", "extensions"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["extensions", "networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["rbac.authorization.k8s.io"]
    resources: ["roles", "rolebindings"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  labels:
    app.kubernetes.io/managed-by: atomist
    app.kubernetes.io/name: k8s-sdm
    app.kubernetes.io/part-of: k8s-sdm
    atomist.com/workspaceId: T29E48P34
  name: k8s-sdm
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: k8s-sdm
subjects:
  - kind: ServiceAccount
    name: k8s-sdm
---
kind: Deployment
apiVersion: apps/v1
metadata:
  labels:
    app.kubernetes.io/managed-by: atomist
    app.kubernetes.io/name: k8s-sdm
    app.kubernetes.io/part-of: k8s-sdm
    atomist.com/workspaceId: T29E48P34
  name: k8s-sdm
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: k8s-sdm
      atomist.com/workspaceId: T29E48P34
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/managed-by: atomist
        app.kubernetes.io/name: k8s-sdm
        app.kubernetes.io/part-of: k8s-sdm
        app.kubernetes.io/version: "1"
        atomist.com/workspaceId: T29E48P34
    spec:
      containers:
        - env:
            - name: ATOMIST_CONFIG_PATH
              value: /opt/atm/client.config.json
            - name: TMPDIR
              value: /tmp
          image: atomist/k8s-sdm:1.5.0
          livenessProbe:
            failureThreshold: 3
            httpGet:
              path: /health
              port: http
              scheme: HTTP
            initialDelaySeconds: 20
            periodSeconds: 20
            successThreshold: 1
            timeoutSeconds: 3
          name: k8s-sdm
          ports:
            - name: http
              containerPort: 2866
              protocol: TCP
          readinessProbe:
            failureThreshold: 3
            httpGet:
              path: /health
              port: http
              scheme: HTTP
            initialDelaySeconds: 20
            periodSeconds: 20
            successThreshold: 1
            timeoutSeconds: 3
          resources:
            limits:
              cpu: 500m
              memory: 768Mi
            requests:
              cpu: 100m
              memory: 512Mi
          securityContext:
            allowPrivilegeEscalation: false
            privileged: false
            readOnlyRootFilesystem: true
          volumeMounts:
            - mountPath: /opt/atm
              name: k8s-sdm
              readOnly: true
            - mountPath: /home/atomist
              name: home
            - mountPath: /tmp
              name: tmp
      initContainers:
        - args:
            - git config --global user.email 'bot@atomist.com' && git config --global user.name 'Atomist Bot'
          command: ["/bin/sh", "-c"]
          image: atomist/sdm-base:0.3.0
          name: "home"
          securityContext:
            allowPrivilegeEscalation: false
            privileged: false
            readOnlyRootFilesystem: true
          volumeMounts:
            - mountPath: /home/atomist
              name: home
      securityContext:
        fsGroup: 2866
        runAsGroup: 2866
        runAsNonRoot: true
        runAsUser: 2866
        supplementalGroups: []
        sysctls: []
      serviceAccountName: k8s-sdm
      volumes:
        - name: k8s-sdm
          secret:
            defaultMode: 288
            secretName: k8s-sdm
        - emptyDir: {}
          name: home
        - emptyDir: {}
          name: tmp
`;
            const s = processSpecs(r, "franklin-avenue");
            const e: any[] = [
                {
                    apiVersion: "v1",
                    kind: "ServiceAccount",
                    metadata: {
                        labels: {
                            "app.kubernetes.io/managed-by": "atomist",
                            "app.kubernetes.io/name": "k8s-sdm",
                            "app.kubernetes.io/part-of": "k8s-sdm",
                            "atomist.com/workspaceId": "T29E48P34",
                        },
                        name: "k8s-sdm",
                        namespace: "franklin-avenue",
                    },
                },
                {
                    apiVersion: "rbac.authorization.k8s.io/v1",
                    kind: "Role",
                    metadata: {
                        labels: {
                            "app.kubernetes.io/managed-by": "atomist",
                            "app.kubernetes.io/name": "k8s-sdm",
                            "app.kubernetes.io/part-of": "k8s-sdm",
                            "atomist.com/workspaceId": "T29E48P34",
                        },
                        name: "k8s-sdm",
                        namespace: "franklin-avenue",
                    },
                    rules: [
                        {
                            apiGroups: [""],
                            resources: ["pods", "secrets", "serviceaccounts", "services"],
                            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
                        },
                        {
                            apiGroups: ["apps", "extensions"],
                            resources: ["deployments"],
                            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
                        },
                        {
                            apiGroups: ["extensions", "networking.k8s.io"],
                            resources: ["ingresses"],
                            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
                        },
                        {
                            apiGroups: ["rbac.authorization.k8s.io"],
                            resources: ["roles", "rolebindings"],
                            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
                        },
                    ],
                },
                {
                    apiVersion: "rbac.authorization.k8s.io/v1",
                    kind: "RoleBinding",
                    metadata: {
                        labels: {
                            "app.kubernetes.io/managed-by": "atomist",
                            "app.kubernetes.io/name": "k8s-sdm",
                            "app.kubernetes.io/part-of": "k8s-sdm",
                            "atomist.com/workspaceId": "T29E48P34",
                        },
                        name: "k8s-sdm",
                        namespace: "franklin-avenue",
                    },
                    roleRef: {
                        apiGroup: "rbac.authorization.k8s.io",
                        kind: "Role",
                        name: "k8s-sdm",
                    },
                    subjects: [
                        {
                            kind: "ServiceAccount",
                            name: "k8s-sdm",
                        },
                    ],
                },
                {
                    apiVersion: "apps/v1",
                    kind: "Deployment",
                    metadata: {
                        labels: {
                            "app.kubernetes.io/managed-by": "atomist",
                            "app.kubernetes.io/name": "k8s-sdm",
                            "app.kubernetes.io/part-of": "k8s-sdm",
                            "atomist.com/workspaceId": "T29E48P34",
                        },
                        name: "k8s-sdm",
                        namespace: "franklin-avenue",
                    },
                    spec: {
                        replicas: 1,
                        selector: {
                            matchLabels: {
                                "app.kubernetes.io/name": "k8s-sdm",
                                "atomist.com/workspaceId": "T29E48P34",
                            },
                        },
                        strategy: {
                            rollingUpdate: {
                                maxSurge: 1,
                                maxUnavailable: 0,
                            },
                            type: "RollingUpdate",
                        },
                        template: {
                            metadata: {
                                labels: {
                                    "app.kubernetes.io/managed-by": "atomist",
                                    "app.kubernetes.io/name": "k8s-sdm",
                                    "app.kubernetes.io/part-of": "k8s-sdm",
                                    "app.kubernetes.io/version": "1",
                                    "atomist.com/workspaceId": "T29E48P34",
                                },
                            },
                            spec: {
                                containers: [
                                    {
                                        env: [
                                            {
                                                name: "ATOMIST_CONFIG_PATH",
                                                value: "/opt/atm/client.config.json",
                                            },
                                            {
                                                name: "TMPDIR",
                                                value: "/tmp",
                                            },
                                        ],
                                        image: "atomist/k8s-sdm:1.5.0",
                                        livenessProbe: {
                                            failureThreshold: 3,
                                            httpGet: {
                                                path: "/health",
                                                port: "http",
                                                scheme: "HTTP",
                                            },
                                            initialDelaySeconds: 20,
                                            periodSeconds: 20,
                                            successThreshold: 1,
                                            timeoutSeconds: 3,
                                        },
                                        name: "k8s-sdm",
                                        ports: [
                                            {
                                                containerPort: 2866,
                                                name: "http",
                                                protocol: "TCP",
                                            },
                                        ],
                                        readinessProbe: {
                                            failureThreshold: 3,
                                            httpGet: {
                                                path: "/health",
                                                port: "http",
                                                scheme: "HTTP",
                                            },
                                            initialDelaySeconds: 20,
                                            periodSeconds: 20,
                                            successThreshold: 1,
                                            timeoutSeconds: 3,
                                        },
                                        resources: {
                                            limits: {
                                                cpu: "500m",
                                                memory: "768Mi",
                                            },
                                            requests: {
                                                cpu: "100m",
                                                memory: "512Mi",
                                            },
                                        },
                                        securityContext: {
                                            allowPrivilegeEscalation: false,
                                            privileged: false,
                                            readOnlyRootFilesystem: true,
                                        },
                                        volumeMounts: [
                                            {
                                                mountPath: "/opt/atm",
                                                name: "k8s-sdm",
                                                readOnly: true,
                                            },
                                            {
                                                mountPath: "/home/atomist",
                                                name: "home",
                                            },
                                            {
                                                mountPath: "/tmp",
                                                name: "tmp",
                                            },
                                        ],
                                    },
                                ],
                                initContainers: [
                                    {
                                        args: [
                                            "git config --global user.email 'bot@atomist.com' && git config --global user.name 'Atomist Bot'",
                                        ],
                                        command: [
                                            "/bin/sh",
                                            "-c",
                                        ],
                                        image: "atomist/sdm-base:0.3.0",
                                        name: "home",
                                        securityContext: {
                                            allowPrivilegeEscalation: false,
                                            privileged: false,
                                            readOnlyRootFilesystem: true,
                                        },
                                        volumeMounts: [
                                            {
                                                mountPath: "/home/atomist",
                                                name: "home",
                                            },
                                        ],
                                    },
                                ],
                                securityContext: {
                                    fsGroup: 2866,
                                    runAsGroup: 2866,
                                    runAsNonRoot: true,
                                    runAsUser: 2866,
                                    supplementalGroups: [],
                                    sysctls: [],
                                },
                                serviceAccountName: "k8s-sdm",
                                volumes: [
                                    {
                                        name: "k8s-sdm",
                                        secret: {
                                            defaultMode: 288,
                                            secretName: "k8s-sdm",
                                        },
                                    },
                                    {
                                        emptyDir: {},
                                        name: "home",
                                    },
                                    {
                                        emptyDir: {},
                                        name: "tmp",
                                    },
                                ],
                            },
                        },
                    },
                },
            ];
            assert.deepStrictEqual(s, e);
        });

    });

    describe("fetchSpecs", () => {

        let origLog: any;
        let logged: boolean;
        before(() => {
            origLog = Object.getOwnPropertyDescriptor(print, "log");
            Object.defineProperty(print, "log", {
                value: (l: string) => {
                    logged = true;
                },
            });
        });
        after(() => {
            Object.defineProperty(print, "log", origLog);
        });
        beforeEach(() => {
            logged = false;
        });

        it("should fetch the cluster specs", async () => {
            const s = await fetchSpecs();
            assert(s.length === 10);
            assert(s[0].apiVersion === "v1");
            assert(s[0].kind === "Namespace");
            assert(s[0].metadata.name === "sdm");
            assert(s[1].apiVersion === "v1");
            assert(s[1].kind === "ServiceAccount");
            assert(s[1].metadata.name === "k8s-sdm");
            assert(s[1].metadata.namespace === "sdm");
            assert(s[2].apiVersion === "rbac.authorization.k8s.io/v1");
            assert(s[2].kind === "ClusterRole");
            assert(s[2].metadata.name === "k8s-sdm");
            assert(s[3].apiVersion === "rbac.authorization.k8s.io/v1");
            assert(s[3].kind === "ClusterRoleBinding");
            assert(s[3].metadata.name === "k8s-sdm");
            assert(s[4].apiVersion === "apps/v1");
            assert(s[4].kind === "Deployment");
            assert(s[4].metadata.name === "k8s-sdm");
            assert(s[4].metadata.namespace === "sdm");
            assert(s[5].apiVersion === "v1");
            assert(s[5].kind === "Namespace");
            assert(s[5].metadata.name === "k8vent");
            assert(s[6].apiVersion === "v1");
            assert(s[6].kind === "ServiceAccount");
            assert(s[6].metadata.name === "k8vent");
            assert(s[6].metadata.namespace === "k8vent");
            assert(s[7].apiVersion === "rbac.authorization.k8s.io/v1");
            assert(s[7].kind === "ClusterRole");
            assert(s[7].metadata.name === "k8vent");
            assert(s[8].apiVersion === "rbac.authorization.k8s.io/v1");
            assert(s[8].kind === "ClusterRoleBinding");
            assert(s[8].metadata.name === "k8vent");
            assert(s[9].apiVersion === "apps/v1");
            assert(s[9].kind === "Deployment");
            assert(s[9].metadata.name === "k8vent");
            assert(s[9].metadata.namespace === "k8vent");
            assert(logged, "fetching not logged");
        }).timeout(5000);

        it("should fetch the namespace specs", async () => {
            const s = await fetchSpecs("complexion");
            assert(s.length === 8);
            assert(s[0].apiVersion === "v1");
            assert(s[0].kind === "ServiceAccount");
            assert(s[0].metadata.name === "k8s-sdm");
            assert(s[0].metadata.namespace === "complexion");
            assert(s[1].apiVersion === "rbac.authorization.k8s.io/v1");
            assert(s[1].kind === "Role");
            assert(s[1].metadata.name === "k8s-sdm");
            assert(s[1].metadata.namespace === "complexion");
            assert(s[2].apiVersion === "rbac.authorization.k8s.io/v1");
            assert(s[2].kind === "RoleBinding");
            assert(s[2].metadata.name === "k8s-sdm");
            assert(s[2].metadata.namespace === "complexion");
            assert(s[3].apiVersion === "apps/v1");
            assert(s[3].kind === "Deployment");
            assert(s[3].metadata.name === "k8s-sdm");
            assert(s[3].metadata.namespace === "complexion");
            assert(s[4].apiVersion === "v1");
            assert(s[4].kind === "ServiceAccount");
            assert(s[4].metadata.name === "k8vent");
            assert(s[4].metadata.namespace === "complexion");
            assert(s[5].apiVersion === "rbac.authorization.k8s.io/v1");
            assert(s[5].kind === "Role");
            assert(s[5].metadata.name === "k8vent");
            assert(s[5].metadata.namespace === "complexion");
            assert(s[6].apiVersion === "rbac.authorization.k8s.io/v1");
            assert(s[6].kind === "RoleBinding");
            assert(s[6].metadata.name === "k8vent");
            assert(s[6].metadata.namespace === "complexion");
            assert(s[7].apiVersion === "apps/v1");
            assert(s[7].kind === "Deployment");
            assert(s[7].metadata.name === "k8vent");
            assert(s[7].metadata.namespace === "complexion");
            assert(logged, "fetching not logged");
        }).timeout(5000);

    });

    describe("specSlug", () => {

        it("should return the slug", () => {
            const s = {
                apiVersion: "v1",
                kind: "ServiceAccount",
                metadata: {
                    name: "thunder",
                    namespace: "lightning",
                },
            };
            const l = specSlug(s);
            const e = "ServiceAccount/lightning/thunder";
            assert(l === e);
        });

        it("should return slug without namespace", () => {
            const s = {
                apiVersion: "rbac.kubernetes.io/v1",
                kind: "ClusterRole",
                metadata: {
                    name: "thunder",
                },
            };
            const l = specSlug(s);
            const e = "ClusterRole/thunder";
            assert(l === e);
        });

    });

    describe("applySpec", () => {

        let origLog: any;
        before(() => {
            origLog = Object.getOwnPropertyDescriptor(print, "log");
        });
        after(() => {
            Object.defineProperty(print, "log", origLog);
        });

        it("should create a resource", async () => {
            const s = {
                apiKind: "v1",
                kind: "Service",
                metadata: {
                    name: "alright",
                    namespace: "to-pimp-a-butterfly",
                },
            };
            let created = false;
            const c: any = {
                create: async (o: K8sObject) => {
                    created = true;
                    assert.deepStrictEqual(s, o);
                },
                read: async (o: K8sObject) => {
                    throw new Error("no");
                },
            };
            let logged = false;
            Object.defineProperty(print, "log", {
                value: (l: string) => {
                    logged = true;
                    assert(l === "Creating Service/to-pimp-a-butterfly/alright");
                },
            });
            await applySpec(c, s);
            assert(created, "resource not created");
            assert(logged, "log not printed");
        });

        it("should patch a resource", async () => {
            const s = {
                apiKind: "v1",
                kind: "Service",
                metadata: {
                    name: "alright",
                    namespace: "to-pimp-a-butterfly",
                },
            };
            let patched = false;
            const c: any = {
                read: async (o: K8sObject) => ({}),
                patch: async (o: K8sObject) => {
                    patched = true;
                    assert.deepStrictEqual(s, o);
                },
            };
            let logged = false;
            Object.defineProperty(print, "log", {
                value: (l: string) => {
                    logged = true;
                    assert(l === "Updating Service/to-pimp-a-butterfly/alright");
                },
            });
            await applySpec(c, s);
            assert(patched, "resource not patched");
            assert(logged, "log not printed");
        });

    });

});
