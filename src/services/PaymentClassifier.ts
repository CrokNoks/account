import * as tf from '@tensorflow/tfjs';
import { supabaseClient } from '../supabaseClient';

export type PaymentMethod = 'credit_card' | 'direct_debit' | 'transfer' | 'check' | 'cash' | 'other';

interface TrainingExample {
  text: string;
  label: PaymentMethod;
}

const TRAINING_DATA: TrainingExample[] = [
  // Prélèvements
  { text: 'PRLV SEPA EDF', label: 'direct_debit' },
  { text: 'PRLV FREE MOBILE', label: 'direct_debit' },
  { text: 'PRELEVEMENT SC NETFLIX', label: 'direct_debit' },
  { text: 'PRLV COTISATION', label: 'direct_debit' },
  { text: 'PRLV IMPOTS', label: 'direct_debit' },
  { text: 'PRLV ASSURANCE', label: 'direct_debit' },
  { text: 'ECHEANCE PRET', label: 'direct_debit' },
  { text: 'PRLV SEPA', label: 'direct_debit' },

  // Carte Bancaire
  { text: 'CARTE XXXXX CARREFOUR', label: 'credit_card' },
  { text: 'CB E.LECLERC', label: 'credit_card' },
  { text: 'PAIEMENT CB', label: 'credit_card' },
  { text: 'PAIEMENT PAR CARTE', label: 'credit_card' },
  { text: 'CB RESTAURANT', label: 'credit_card' },
  { text: 'CB AMAZON', label: 'credit_card' },
  { text: 'PAIEMENT SC SNCF', label: 'credit_card' },
  { text: 'CB UBER', label: 'credit_card' },
  { text: 'RETRAIT DAB', label: 'cash' }, // Usually handled as cash or withdrawal
  { text: 'CB BOULANGERIE', label: 'credit_card' },

  // Virements
  { text: 'VIR SEPA MR DUPONT', label: 'transfer' },
  { text: 'VIREMENT SALAIRE', label: 'transfer' },
  { text: 'VIR RECU', label: 'transfer' },
  { text: 'VIREMENT EMIS', label: 'transfer' },
  { text: 'VIR INST', label: 'transfer' },
  { text: 'VIR PERMANENT', label: 'transfer' },

  // Chèques
  { text: 'CHEQUE 123456', label: 'check' },
  { text: 'REMISE DE CHEQUE', label: 'check' },
  { text: 'CHEQUE EMIS', label: 'check' },

  // Cash / Retrait
  { text: 'RETRAIT ESPECES', label: 'cash' },
  { text: 'RETRAIT DAB', label: 'cash' },

  // Autre
  { text: 'FRAIS BANCAIRES', label: 'other' },
  { text: 'AGIOS', label: 'other' },
  { text: 'COMMISSIONS', label: 'other' }
];

const LABELS: PaymentMethod[] = ['credit_card', 'direct_debit', 'transfer', 'check', 'cash', 'other'];

export class PaymentClassifier {
  private model: tf.Sequential;
  private vocab: Map<string, number>;
  private maxLen: number = 10;
  private isTrained: boolean = false;

  private customExamples: TrainingExample[] = [];

  constructor() {
    this.model = tf.sequential();
    this.vocab = new Map();
  }

  // Tokenize text into words
  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  // Build vocabulary from training data
  private buildVocab(data: TrainingExample[]) {
    this.vocab.clear();
    let index = 1; // 0 reserved for padding/unknown
    data.forEach(item => {
      const tokens = this.tokenize(item.text);
      tokens.forEach(token => {
        if (!this.vocab.has(token)) {
          this.vocab.set(token, index++);
        }
      });
    });
  }

  // Convert text to sequence of indices
  private textToSequence(text: string): number[] {
    const tokens = this.tokenize(text);
    const seq = tokens.map(token => this.vocab.get(token) || 0);
    // Pad or truncate
    if (seq.length > this.maxLen) {
      return seq.slice(0, this.maxLen);
    }
    while (seq.length < this.maxLen) {
      seq.push(0);
    }
    return seq;
  }

  // Initialize and train the model
  async init(forceRetrain = false) {
    if (this.isTrained && !forceRetrain) return;

    if (this.model) {
      try {
        // Disposing model if it exists to avoid memory leaks on retrain
        // Actually tf.sequential() creates a new generic container, 
        // but we should dispose tensors if we can. 
        // There isn't a simple model.dispose() that clears everything safely in all versions,
        // but we will create a NEW model instance anyway.
        this.model.dispose();
      } catch (e) { /* ignore */ }
    }

    // Re-create model container
    this.model = tf.sequential();

    // Fetch existing data from Supabase if not already fetched? 
    // For simplicity, we fetch every time or we could cache. 
    // Given the user issue, let's fetch fresh.
    let dbExamples: TrainingExample[] = [];
    try {
      const { data } = await supabaseClient
        .from('expenses')
        .select('description, payment_method')
        .not('payment_method', 'is', null)
        .limit(2000);

      if (data) {
        dbExamples = data
          .filter(d => d.description && d.payment_method && LABELS.includes(d.payment_method as PaymentMethod))
          .map(d => ({
            text: d.description,
            label: d.payment_method as PaymentMethod
          }));
      }
    } catch (e) {
      console.warn('Could not fetch existing training data, using default only', e);
    }

    // Combine all sources
    let allData = [...TRAINING_DATA, ...dbExamples, ...this.customExamples];

    // BALANCING STRATEGY:
    // 1. Count occurrences
    const counts: Record<string, number> = {};
    LABELS.forEach(l => counts[l] = 0);
    allData.forEach(d => counts[d.label] = (counts[d.label] || 0) + 1);

    console.log('Class distribution before balancing:', counts);

    // 2. Determine max allowed (avg * 2 or just hard cap?)
    // Let's cap at 100 per class to avoid total dominance? Or max(TRAINING_DATA.length * 3)?
    // Simple approach: Undersample dominant classes to median*2 ?
    // Or just ensure no class has > 50% of total?

    // Simple heuristic: If one class has > 2x the count of the second biggest, cap it.
    // Let's try to keep it simple: Limit any class to 50 examples from DB.
    // BUT we must keep CUSTOM examples and TRAINING_DATA (gold standard).
    // So we filter DB examples only.

    const protectedData = [...TRAINING_DATA, ...this.customExamples];
    const dbData = [...dbExamples];

    // Shuffle DB data to pick random ones if we cut
    dbData.sort(() => Math.random() - 0.5);

    const dbCounts: Record<string, number> = {};
    const balancedDbData: TrainingExample[] = [];
    const CAP_PER_CLASS = 50;

    // Fill up to CAP from DB
    dbData.forEach(item => {
      if (!dbCounts[item.label]) dbCounts[item.label] = 0;
      if (dbCounts[item.label] < CAP_PER_CLASS) {
        balancedDbData.push(item);
        dbCounts[item.label]++;
      }
    });

    const trainingData = [...protectedData, ...balancedDbData];

    // Log new distribution
    const finalCounts: Record<string, number> = {};
    trainingData.forEach(d => finalCounts[d.label] = (finalCounts[d.label] || 0) + 1);
    console.log('Class distribution after balancing:', finalCounts);

    this.buildVocab(trainingData);

    // Prepare data
    const xs = tf.tensor2d(trainingData.map(item => this.textToSequence(item.text)));
    const ys = tf.tensor2d(trainingData.map(item => {
      const oneHot = Array(LABELS.length).fill(0);
      oneHot[LABELS.indexOf(item.label)] = 1;
      return oneHot;
    }));

    // Define model
    this.model.add(tf.layers.embedding({
      inputDim: this.vocab.size + 1,
      outputDim: 8,
      inputLength: this.maxLen
    }));
    this.model.add(tf.layers.flatten());
    this.model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    this.model.add(tf.layers.dense({ units: LABELS.length, activation: 'softmax' }));

    this.model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Train
    await this.model.fit(xs, ys, {
      epochs: 40,
      shuffle: true,
      verbose: 0
    });

    this.isTrained = true;
    xs.dispose();
    ys.dispose();
    console.log(`PaymentClassifier trained successfully with ${trainingData.length} examples`);
  }

  async predict(text: string): Promise<{ label: PaymentMethod; confidence: number }> {
    if (!this.isTrained) await this.init();

    const input = tf.tensor2d([this.textToSequence(text)]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const data = await prediction.data();
    const maxVal = Math.max(...data);
    const index = data.indexOf(maxVal);

    input.dispose();
    prediction.dispose();

    return { label: LABELS[index], confidence: maxVal };
  }

  async addExample(text: string, label: PaymentMethod) {
    if (!text || !label) return;

    // Add to training data
    this.customExamples.push({ text, label });
    console.log(`Added custom example: ${text} -> ${label}. Retraining...`);

    // Force re-train
    await this.init(true);
  }
}

export const paymentClassifier = new PaymentClassifier();
