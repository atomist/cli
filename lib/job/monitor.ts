import { Deferred } from "@atomist/automation-client/lib/internal/util/Deferred";
import { loadKubeConfig } from "@atomist/sdm-core/lib/pack/k8s/config";
import * as k8s from "@kubernetes/client-node";
import * as fs from "fs-extra";
import * as glob from "glob";
import * as _ from "lodash";
import * as path from "path";
import * as print from "..//print";

export interface MonitorOptions {
    goalSetId: string;
    job: {
        name: string;
        namespace: string;
    };
    container: {
        name: string;
    }
}

export async function monitor(opts: MonitorOptions): Promise<number> {

    // 1. monitor job for completion
    let w: any;
    let code: number;
    try {
        const kc = loadKubeConfig();
        const core = kc.makeApiClient(k8s.Core_v1Api);
        const podSpecs = await core.listNamespacedPod(
            opts.job.namespace,
            undefined,
            undefined,
            undefined,
            undefined,
            `job-name=${opts.job.name}`);

        print.info(`Loaded own k8s pod spec`);

        const deferred = new Deferred<number>();

        const podSpec = podSpecs.body.items[0];

        print.info(`Starting watch for container '${opts.container.name}' in '${
            podSpec.metadata.namespace}:${podSpec.metadata.name}'`);
        w = podWatch(opts.container.name, podSpec, deferred);

        code = await deferred.promise;
    } catch (e) {
        print.error(JSON.stringify(e.body, null, 2));
        return 10;
    } finally {
        if (!!w) {
            w.abort();
        }
    }

        // 2. store caches
    const outputs: string[] = JSON.parse(process.env.ATOMIST_OUTPUT || "[]");
    for (const output of outputs) {
        print.info(`Storing '${output}'`);
        try {
            const files = glob.sync(output, { cwd: process.cwd() });
            for (const file of files) {
                await fs.copy(path.join(process.cwd(), file), path.join("/", "atm", "share", file), {
                    overwrite: true,
                    recursive: true,
                });
                print.info(`Successfully stored '${file}'`);
            }
        } catch (e) {
            print.info(`Failed to store '${output}': ${JSON.stringify(e)}`);
        }
    }

    return code;
}

function podWatch(containerName: string, pod: k8s.V1Pod, deferred: Deferred<number>) {
    const kc = loadKubeConfig();
    const watch = new k8s.Watch(kc);
    return watch.watch(
        `/api/v1/watch/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}`,
        {},
        (phase, obj) => {
            const podEvent = obj as k8s.V1Pod;

            const container = podEvent.status.containerStatuses.find(c => c.name === containerName);
            const exitCode = _.get(container, "state.terminated.exitCode");

            if (exitCode === 0) {
                print.info(`Container '${containerName}' excited with 0`);
                deferred.resolve(exitCode);
            } else if (exitCode !== undefined && exitCode !== 0) {
                print.info(`Container '${containerName}' excited with ${exitCode}`);
                deferred.resolve(exitCode);
            } else {
                print.info(`Container '${containerName}' still running`);
            }
        },
        err => console.log(err),
    );
}
