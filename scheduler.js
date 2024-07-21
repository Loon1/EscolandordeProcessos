class Process {
    constructor(id, start, duration, deadline, onStart = () => { }, onTick = () => { }, onFinish = () => { }) {
        this._assertArguments(start, duration, deadline)

        this.id = id
        this.start = start
        this.duration = duration
        this.deadline = deadline
        this.elapsed = 0
        this.onStart = onStart
        this.onTick = onTick
        this.onFinish = onFinish
    }

    tick() {
        if (this.elapsed === 0) this.onStart()
        this.elapsed++
        this.onTick()
        if (this.elapsed === this.duration) this.onFinish()
    }

    started() {
        return this.elapsed > 0
    }

    finished() {
        return this.elapsed >= this.duration
    }

    _assertArguments(start, duration, deadline) {
        if (start < 0) throw Error("'start' has to be greater than or equal to 0")
        if (duration <= 0) throw Error("'duration' has to be greater than 0")
        if (deadline <= 0) throw Error("'deadline' has to be greater than 0")
        if (deadline <= start) throw Error("'deadline' has to be greater than 'start'")
    }
}

class Scheduler {
    constructor(
        algorithm,
        quantum,
        overload,
        onProcessEnterExecution = (process) => { },
        onProcessLeavesExecution = (process) => { },
        onProcessEnterReadyQueue = (process) => { }
    ) {
        this._algorithm = algorithm
        this._quantum = quantum
        this._overload = overload
        this._onProcessEnterExecution = onProcessEnterExecution
        this._onProcessLeavesExecution = onProcessLeavesExecution
        this._onProcessEnterReadyQueue = onProcessEnterReadyQueue

        this._clock = 0
        this._currentQuantum = quantum
        this._currentOverload = 0
        this._inExecution = null
        this._jobQueue = []
        this._readyQueue = []
    }

    enterProcess(...process) {
        this._jobQueue.push(...process)
        this._syncQueues()
        this._syncInExecution()
    }

    tick() {
        this._clock++;
        this._syncQueues()
        this._syncInExecution()
        if (this._inExecution !== null) {
            this._inExecution.tick()
            if ((this._algorithm === "RR" || this._algorithm === "EDF") && this._currentQuantum > 0) this._currentQuantum--
        }
        if (this._currentOverload > 0) this._currentOverload--
        this._syncInExecution()
    }

    _syncQueues() {
        this._jobQueue.sort((a, b) => b.start - a.start)
        while (this._jobQueue.length > 0 && this._jobQueue[this._jobQueue.length - 1].start <= this._clock) {
            this._addToReadyQueue(this._jobQueue.pop())
        }
        this._syncReadyQueue()
    }

    _addToReadyQueue(process) {
        if (this._algorithm === "FIFO" || this._algorithm === "RR") this._readyQueue.unshift(process)
        else this._readyQueue.push(process)
        this._onProcessEnterReadyQueue(process)
    }

    _syncReadyQueue() {
        if (this._algorithm === "SJF") this._readyQueue.sort((a, b) => b.duration - a.duration)
        else if (this._algorithm === "EDF") this._readyQueue.sort((a, b) => b.deadline - a.deadline)
    }

    _syncInExecution() {
        if (this._currentOverload > 0) return
        if (this._inExecution === null) {
            if (this._readyQueue.length > 0) {
                this._inExecution = this._readyQueue.pop()
                this._onProcessEnterExecution(this._inExecution)
            }
        } else {
            if (this._algorithm === "RR" || this._algorithm === "EDF") {
                if (this._inExecution.finished()) {
                    this._onProcessLeavesExecution(this._inExecution)
                    this._inExecution = null
                    this._currentQuantum = this._quantum
                    this._syncInExecution()
                } else {
                    if (this._currentQuantum === 0) {
                        this._onProcessLeavesExecution(this._inExecution)
                        this._addToReadyQueue(this._inExecution)
                        this._inExecution = null
                        this._syncReadyQueue()
                        this._currentOverload = this._overload
                        this._currentQuantum = this._quantum
                        this._syncInExecution()
                    }
                }
            } else if (this._algorithm === "FIFO" || this._algorithm === "SJF") {
                if (this._inExecution.finished()) {
                    this._onProcessLeavesExecution(this._inExecution)
                    this._inExecution = null
                    this._syncInExecution()
                }
            }
        }
    }
}
