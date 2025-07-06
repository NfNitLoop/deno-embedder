import { debounce, deferred } from "@std/async";


/** Like Deno's watchFS, but will also fire an event once FS events have been quiet for a time */
export class WatchFsQuiet implements AsyncIterable<Deno.FsEvent | QuietEvent> {
    #watcher: Deno.FsWatcher
    #fsIter: AsyncIterableIterator<Deno.FsEvent>;

    constructor(srcDir: string, private quietMs: number = 200) {
        this.#watcher = Deno.watchFs(srcDir)
        this.#fsIter = this.#watcher[Symbol.asyncIterator]()
    }

    async *[Symbol.asyncIterator](): AsyncIterator<Deno.FsEvent|QuietEvent> {
        let next = this.#fsIter.next()
        let quietPromise = deferred<QuietEvent>()
        let waitForQuiet = debounce(() => {
            quietPromise.resolve( {kind: "quiet", ms: this.quietMs})
            
        }, this.quietMs)

        while (true) {
            let winner = await Promise.race([next, quietPromise])
            if (isIteratorResult(winner)) {
                if (winner.done) {
                    return
                }
                waitForQuiet()
                yield winner.value
                next = this.#fsIter.next()
            } else {
                yield winner
                quietPromise = deferred()
            }
        }
    }

    close() {
        this.#watcher.close()
    }
}


type QuietEvent = {
    kind: "quiet"
    ms: number
}

function isIteratorResult(value: unknown): value is IteratorResult<Deno.FsEvent> {
    return (
        value !== null 
        && typeof(value) == "object" 
        && "value" in value
    )
}
