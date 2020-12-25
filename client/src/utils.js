
export class Queue {
  items = [];

  constructor() {
    this.items = [];
  }

  // add element to the queue
  enqueue(element) {
    this.items.unshift(element);
    return element;
  }

  // remove element from the queue
  dequeue() {
    if (this.items.length > 0) {
      return this.items.pop();
    }
  }


  fetchAndPushBack() {
    return this.enqueue(this.dequeue());
  }

  // view the last element
  peek() {
    return this.items[this.items.length - 1];
  }

  // check if the queue is empty
  isEmpty() {
    return this.items.length == 0;
  }

  // the size of the queue
  get size() {
    return this.items.length;
  }

  // empty the queue
  clear() {
    this.items = [];
  }
}