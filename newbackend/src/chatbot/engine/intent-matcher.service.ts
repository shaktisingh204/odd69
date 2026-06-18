import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class IntentMatcherService {
  private readonly MIN_THRESHOLD = 0.3;

  constructor(private readonly prisma: PrismaService) {}

  async matchIntent(
    message: string,
  ): Promise<{
    intentId: number | null;
    intentName: string | null;
    confidence: number;
  }> {
    const matches = await this.testMatch(message);

    if (matches.length === 0 || matches[0].confidence < this.MIN_THRESHOLD) {
      return { intentId: null, intentName: null, confidence: 0 };
    }

    return matches[0];
  }

  async testMatch(
    message: string,
  ): Promise<Array<{ intentId: number; intentName: string; confidence: number }>> {
    const intents = await this.prisma.chatbotIntent.findMany({
      where: { isEnabled: true },
      include: { trainingPhrases: true },
    });

    const results: Array<{
      intentId: number;
      intentName: string;
      confidence: number;
    }> = [];

    const messageLower = message.toLowerCase().trim();
    const messageWords = this.tokenize(messageLower);

    for (const intent of intents) {
      let bestConfidence = 0;

      for (const phrase of intent.trainingPhrases) {
        const phraseText = phrase.phrase;
        const phraseLower = phraseText.toLowerCase().trim();

        // Exact match
        if (messageLower === phraseLower) {
          bestConfidence = Math.max(bestConfidence, 1.0);
          break;
        }

        // Lowercase includes match
        if (
          messageLower.includes(phraseLower) ||
          phraseLower.includes(messageLower)
        ) {
          bestConfidence = Math.max(bestConfidence, 0.85);
          continue;
        }

        // Jaccard similarity (word overlap)
        const phraseWords = this.tokenize(phraseLower);
        const jaccard = this.jaccardSimilarity(messageWords, phraseWords);
        bestConfidence = Math.max(bestConfidence, jaccard);
      }

      if (bestConfidence >= this.MIN_THRESHOLD) {
        results.push({
          intentId: intent.id,
          intentName: intent.name,
          confidence: bestConfidence,
        });
      }
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results;
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .split(/\s+/)
        .filter((w) => w.length > 0),
    );
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0;

    let intersection = 0;
    for (const word of a) {
      if (b.has(word)) intersection++;
    }

    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}
