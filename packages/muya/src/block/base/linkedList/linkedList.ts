import type { Nullable } from '../../../types';
import type { ILinkedNode } from './linkedNode';

export class LinkedList<T extends ILinkedNode> {
    head: Nullable<T> = null;

    tail: Nullable<T> = null;

    length: number = 0;

    * iterator(curNode = this.head, length = this.length) {
        let count = 0;

        while (count < length && curNode) {
            yield curNode;
            count++;
            curNode = curNode.next as T;
        }
    }

    append(...nodes: T[]) {
        for (const node of nodes)
            this.insertBefore(node);
    }

    contains(node: T) {
        const it = this.iterator();
        let data = null;

        // eslint-disable-next-line no-cond-assign
        while ((data = it.next()).done !== true) {
            const { value } = data;
            if (value === node)
                return true;
        }

        return false;
    }

    insertBefore(node: T, refNode: T | null = null) {
        if (!node)
            return;
        node.next = refNode;
        if (refNode !== null) {
            node.prev = refNode.prev;
            if (refNode.prev != null)
                refNode.prev.next = node;

            refNode.prev = node;
            if (this.head === refNode)
                this.head = node;
        }
        else if (this.tail != null) {
            this.tail.next = node;
            node.prev = this.tail;
            this.tail = node;
        }
        else {
            node.prev = null;
            this.head = this.tail = node;
        }
        this.length += 1;
    }

    offset(node: T): number {
        let i = 0;
        for (const cur of this.iterator()) {
            if (cur === node)
                return i;
            i++;
        }
        return -1;
    }

    remove(node: T) {
    // If linkedList does not contain this node, just return
        if (!this.contains(node))
            return;
        if (node.prev)
            node.prev.next = node.next;

        if (node.next)
            node.next.prev = node.prev;

        if (this.head === node)
            this.head = node.next as T;

        if (this.tail === node)
            this.tail = node.prev as T;

        this.length -= 1;
    }

    find(index: number): Nullable<T> {
        if (index < 0 || index >= this.length)
            return null;

        let i = 0;
        for (const node of this.iterator()) {
            if (i === index)
                return node;
            i++;
        }
        return null;
    }

    forEach(callback: (cur: T, i: number) => void): void {
        let i = 0;
        for (const node of this.iterator())
            callback(node, i++);
    }

    forEachAt(
        index: number,
        length: number = this.length,
        callback: (cur: T, i: number) => void,
    ): void {
        const curNode = this.find(index);
        if (!curNode)
            return;

        let i = 0;
        for (const node of this.iterator(curNode, length))
            callback(node, index + i++);
    }

    map<M>(callback: (cur: T, i: number) => M): M[] {
        // Snapshot via spread: callbacks may reparent nodes (which mutates
        // next/prev and breaks lazy iteration); matching Array.prototype.map
        // semantics. find/offset/forEach are on the hot path and don't
        // snapshot because their callbacks are observation-only.
        return [...this.iterator()].map(callback);
    }

    reduce<M>(callback: (memo: M, cur: T, i: number) => M, memo: M): M {
        return [...this.iterator()].reduce(callback, memo);
    }
}
