import * as tf from '@tensorflow/tfjs';
import { supabaseClient } from '../supabaseClient';

export interface ClassificationInput {
  description: string;
  amount: number;
  notes?: string;
  metadata?: any;
}

export class CategoryClassifier {
  private model: tf.Sequential | null = null;
  private categories: { id: string; name: string }[] = [];
  private vocab: Map<string, number> = new Map();
  private currentAccountId: string | null = null;
  private isTrained = false;

  constructor() { }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ') // Replace punctuation with space
      .split(/\s+/)
      .filter(w => w.length > 2); // Filter tiny words
  }

  // Combine description, notes, and metadata into a single text string
  private extractTextFeatures(input: ClassificationInput): string {
    let parts = [input.description, input.amount.toString()];
    if (input.notes) parts.push(input.notes);
    if (input.metadata) {
      try {
        // Simple dump of values
        parts.push(JSON.stringify(input.metadata));
      } catch (e) { }
    }
    return parts.join(' ');
  }



  async init(accountId: string, force = false): Promise<boolean> {
    if (this.currentAccountId === accountId && this.isTrained && !force) return true;

    // Reset
    this.currentAccountId = accountId;
    this.isTrained = false;
    // Don't nullify model if we want to potentially reuse weights, but here we rebuild from scratch for full vocab update.
    this.model = null;

    const { data: cats } = await supabaseClient
      .from('categories')
      .select('id, name')
      .eq('account_id', accountId);

    if (!cats || cats.length === 0) return false;
    this.categories = cats;

    // 2. Fetch Training Data (Expenses with category)
    const { data: expenses } = await supabaseClient
      .from('expenses')
      .select('description, amount, notes, metadata, category_id')
      .eq('account_id', accountId)
      .not('category_id', 'is', null)
      .limit(2000); // Limit data

    if (!expenses || expenses.length < 5) {
      console.warn("CategoryClassifier: Not enough data to train (min 5 expenses needed). Found:", expenses?.length);
      return false;
    }

    console.log(`CategoryClassifier: Training with ${expenses.length} examples and ${this.categories.length} categories.`);

    // 3. Prepare data for Bag-of-Words
    const allText = expenses.map(e => this.extractTextFeatures(e as any));

    // Create Vocab based on frequency
    const wordCounts = new Map<string, number>();
    allText.forEach(text => {
      [...new Set(this.tokenize(text))].forEach(t => wordCounts.set(t, (wordCounts.get(t) || 0) + 1));
    });

    const BOW_SIZE = 200;
    const sortedVocab = [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1]) // Sort by frequency desc
      .slice(0, BOW_SIZE)
      .map(x => x[0]);

    this.vocab.clear();
    sortedVocab.forEach((w, i) => this.vocab.set(w, i)); // index 0..BOW_SIZE-1

    // 4. Transform data to tensors
    const inputs: number[][] = [];
    const labels: number[][] = [];

    expenses.forEach(e => {
      const text = this.extractTextFeatures(e as any);
      const tokens = this.tokenize(text);

      // BoW vector of size BOW_SIZE
      const vec = Array(BOW_SIZE).fill(0);
      tokens.forEach(t => {
        const idx = this.vocab.get(t);
        if (idx !== undefined) vec[idx] = 1;
      });

      // Append Normalized Amount
      const normAmount = Math.log10(Math.max(1, Math.abs(e.amount))) / 5;
      vec.push(normAmount);

      inputs.push(vec);

      // One-Hot Label
      const labelVec = Array(this.categories.length).fill(0);
      const catIndex = this.categories.findIndex(c => c.id === e.category_id);
      if (catIndex >= 0) labelVec[catIndex] = 1;
      labels.push(labelVec);
    });

    const xs = tf.tensor2d(inputs);
    const ys = tf.tensor2d(labels);

    // 5. Create Model
    this.model = tf.sequential();
    // Input size is BOW_SIZE + 1 (amount)
    this.model.add(tf.layers.dense({ inputShape: [BOW_SIZE + 1], units: 32, activation: 'relu' }));
    this.model.add(tf.layers.dropout({ rate: 0.2 }));
    this.model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    this.model.add(tf.layers.dense({ units: this.categories.length, activation: 'softmax' }));

    this.model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    await this.model.fit(xs, ys, {
      epochs: 20,
      shuffle: true,
      verbose: 0
    });

    this.isTrained = true;
    xs.dispose();
    ys.dispose();
    return true;
  }

  async predict(input: ClassificationInput): Promise<{ id: string; score: number } | null> {
    if (!this.isTrained || !this.model) return null;

    const text = this.extractTextFeatures(input);
    const tokens = this.tokenize(text);

    // BoW Vector
    const BOW_SIZE = 200; // MUST match training
    const vec = Array(BOW_SIZE).fill(0);
    tokens.forEach(t => {
      const idx = this.vocab.get(t);
      if (idx !== undefined) vec[idx] = 1;
    });

    // Amount
    const normAmount = Math.log10(Math.max(1, Math.abs(input.amount))) / 5;
    vec.push(normAmount);

    const inputTensor = tf.tensor2d([vec]);
    const predTensor = this.model.predict(inputTensor) as tf.Tensor;
    const data = await predTensor.data();

    // Log top predictions
    const topIndices = Array.from(data)
      .map((score, i) => ({ score, i }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    console.log("CategoryClassifier: Prediction for", text.substring(0, 30), "...", topIndices.map(x => `${this.categories[x.i].name} (${(x.score * 100).toFixed(1)}%)`).join(', '));

    const maxIdx = data.indexOf(Math.max(...data));

    inputTensor.dispose();
    predTensor.dispose();

    if (maxIdx >= 0 && maxIdx < this.categories.length) {
      // Always return top prediction, regardless of confidence, for assistance
      return {
        id: this.categories[maxIdx].id,
        score: data[maxIdx]
      };
    }

    return null;
  }
}


export const categoryClassifier = new CategoryClassifier();
