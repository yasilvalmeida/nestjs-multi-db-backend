import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface NameNormalizationRequest {
  originalName: string;
  context?: string;
  category?: string;
}

export interface NameNormalizationResponse {
  normalizedName: string;
  confidence: number;
  suggestions?: string[];
  reasoning?: string;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;
  private readonly isEnabled: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.isEnabled = !!apiKey;

    if (this.isEnabled) {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
      this.logger.log('OpenAI service initialized successfully');
    } else {
      this.logger.warn(
        'OpenAI API key not provided. Service will use fallback normalization.',
      );
    }
  }

  async normalizeBookmakerName(
    request: NameNormalizationRequest,
  ): Promise<NameNormalizationResponse> {
    if (!this.isEnabled) {
      return this.fallbackNormalization(request.originalName);
    }

    try {
      const prompt = this.buildNormalizationPrompt(request);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert in sports betting and bookmaker name normalization. Your job is to normalize bookmaker names to their standard, canonical forms.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      return this.parseOpenAIResponse(response, request.originalName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error normalizing name with OpenAI: ${errorMessage}`);
      return this.fallbackNormalization(request.originalName);
    }
  }

  async normalizePlayerName(
    playerName: string,
  ): Promise<NameNormalizationResponse> {
    if (!this.isEnabled) {
      return this.fallbackNormalization(playerName);
    }

    try {
      const prompt = `
        Normalize this sports player name to its standard form:
        Original: "${playerName}"
        
        Consider:
        - Remove nicknames in parentheses
        - Standardize name order (First Last)
        - Fix common spelling variations
        - Handle abbreviated names
        
        Respond in JSON format:
        {
          "normalizedName": "Standard Name",
          "confidence": 0.95,
          "suggestions": ["Alternative 1", "Alternative 2"],
          "reasoning": "Brief explanation"
        }
      `;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert in sports player name normalization. Provide accurate, standardized player names.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      return this.parseOpenAIResponse(response, playerName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error normalizing player name with OpenAI: ${errorMessage}`,
      );
      return this.fallbackNormalization(playerName);
    }
  }

  private buildNormalizationPrompt(request: NameNormalizationRequest): string {
    return `
      Normalize this bookmaker name to its standard, canonical form:
      Original: "${request.originalName}"
      Context: ${request.context || 'Sports betting'}
      Category: ${request.category || 'General'}
      
      Common bookmaker normalizations:
      - "bet365" → "Bet365"
      - "william hill" → "William Hill"
      - "paddy power" → "Paddy Power"
      - "betfair" → "Betfair"
      - "888sport" → "888 Sport"
      
      Respond in JSON format:
      {
        "normalizedName": "Canonical Name",
        "confidence": 0.95,
        "suggestions": ["Alternative 1", "Alternative 2"],
        "reasoning": "Brief explanation of normalization"
      }
    `;
  }

  private parseOpenAIResponse(
    response: string,
    originalName: string,
  ): NameNormalizationResponse {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      return {
        normalizedName: parsed.normalizedName || originalName,
        confidence: parsed.confidence || 0.8,
        suggestions: parsed.suggestions || [],
        reasoning: parsed.reasoning || 'AI-powered normalization',
      };
    } catch {
      // If not JSON, treat as plain text
      const normalizedName = response.trim().replace(/['"]/g, '');
      return {
        normalizedName: normalizedName || originalName,
        confidence: 0.7,
        suggestions: [],
        reasoning: 'Simple AI normalization',
      };
    }
  }

  private fallbackNormalization(
    originalName: string,
  ): NameNormalizationResponse {
    // Simple fallback normalization rules
    let normalized = originalName
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Common bookmaker normalizations
    const bookmakerMappings: Record<string, string> = {
      bet365: 'Bet365',
      'william hill': 'William Hill',
      'paddy power': 'Paddy Power',
      betfair: 'Betfair',
      ladbrokes: 'Ladbrokes',
      coral: 'Coral',
      '888 sport': '888 Sport',
      unibet: 'Unibet',
      betway: 'Betway',
      'sky bet': 'Sky Bet',
    };

    const lowerNormalized = normalized.toLowerCase();
    for (const [key, value] of Object.entries(bookmakerMappings)) {
      if (lowerNormalized.includes(key)) {
        normalized = value;
        break;
      }
    }

    return {
      normalizedName: normalized,
      confidence: 0.6,
      suggestions: [],
      reasoning: 'Fallback rule-based normalization',
    };
  }

  async getUsageStats(): Promise<any> {
    if (!this.isEnabled) {
      return { error: 'OpenAI not configured' };
    }

    try {
      // Note: OpenAI doesn't provide usage stats via API in the current version
      // This would typically be tracked internally
      return {
        status: 'available',
        model: 'gpt-3.5-turbo',
        lastUsed: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting OpenAI usage stats: ${errorMessage}`);
      return { error: errorMessage };
    }
  }
}
