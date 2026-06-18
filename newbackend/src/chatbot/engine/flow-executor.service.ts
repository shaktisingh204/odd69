import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma.service';
import {
  BotConversation,
  BotConversationDocument,
} from '../schemas/bot-conversation.schema';

interface FlowNode {
  id: string;
  type: 'message' | 'question' | 'condition' | 'action';
  content?: string;
  contentType?: string;
  richMedia?: any;
  options?: Array<{ label: string; value: string; nextNodeId: string }>;
  condition?: { variable: string; operator: string; value: any };
  action?: { type: string; payload: any };
  nextNodeId?: string;
}

@Injectable()
export class FlowExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(BotConversation.name)
    private readonly botConversationModel: Model<BotConversationDocument>,
  ) {}

  async executeNode(
    conversation: BotConversationDocument,
    userMessage: string,
  ): Promise<{
    response: string;
    contentType: string;
    richMedia?: any;
    flowCompleted?: boolean;
  } | null> {
    if (!conversation.currentFlowId) return null;

    const flow = await this.prisma.chatbotFlow.findUnique({
      where: { id: conversation.currentFlowId },
    });

    if (!flow || !flow.nodes) return null;

    const nodes = flow.nodes as unknown as FlowNode[];
    const currentNode = nodes.find(
      (n) => n.id === conversation.currentNodeId,
    );

    if (!currentNode) return null;

    let response: string | undefined;
    let contentType = 'text';
    let richMedia: any;
    let nextNodeId: string | undefined;

    switch (currentNode.type) {
      case 'message': {
        response = currentNode.content;
        contentType = currentNode.contentType ?? 'text';
        richMedia = currentNode.richMedia;
        nextNodeId = currentNode.nextNodeId;
        break;
      }

      case 'question': {
        const matchedOption = currentNode.options?.find(
          (opt) =>
            opt.value.toLowerCase() === userMessage.toLowerCase() ||
            opt.label.toLowerCase() === userMessage.toLowerCase(),
        );

        if (matchedOption) {
          nextNodeId = matchedOption.nextNodeId;
        } else {
          // No matching option, repeat the question
          response = currentNode.content;
          contentType = currentNode.contentType ?? 'quick_reply';
          richMedia = { options: currentNode.options };
          // Do not advance the node
          return { response, contentType, richMedia };
        }

        // If matched, advance to next node and process it
        if (nextNodeId) {
          const nextNode = nodes.find((n) => n.id === nextNodeId);
          if (nextNode) {
            response = nextNode.content;
            contentType = nextNode.contentType ?? 'text';
            richMedia = nextNode.richMedia;
            nextNodeId = nextNode.nextNodeId;

            await this.botConversationModel.updateOne(
              { _id: conversation._id },
              { $set: { currentNodeId: nextNode.id } },
            );
          }
        }
        break;
      }

      case 'condition': {
        const variables = conversation.flowVariables ?? {};
        const condVar = variables[currentNode.condition?.variable ?? ''];
        const condValue = currentNode.condition?.value;
        let conditionMet = false;

        switch (currentNode.condition?.operator) {
          case 'equals':
            conditionMet = condVar === condValue;
            break;
          case 'not_equals':
            conditionMet = condVar !== condValue;
            break;
          case 'contains':
            conditionMet = String(condVar ?? '').includes(String(condValue));
            break;
          case 'gt':
            conditionMet = Number(condVar) > Number(condValue);
            break;
          case 'lt':
            conditionMet = Number(condVar) < Number(condValue);
            break;
          default:
            conditionMet = false;
        }

        // For conditions, options[0] = true branch, options[1] = false branch
        if (currentNode.options && currentNode.options.length >= 2) {
          nextNodeId = conditionMet
            ? currentNode.options[0].nextNodeId
            : currentNode.options[1].nextNodeId;
        } else {
          nextNodeId = currentNode.nextNodeId;
        }

        // Process the next node immediately
        if (nextNodeId) {
          const nextNode = nodes.find((n) => n.id === nextNodeId);
          if (nextNode) {
            await this.botConversationModel.updateOne(
              { _id: conversation._id },
              { $set: { currentNodeId: nextNode.id } },
            );
            return this.executeNode(
              { ...conversation, currentNodeId: nextNode.id } as any,
              userMessage,
            );
          }
        }
        break;
      }

      case 'action': {
        // Store action result in flow variables if needed
        if (currentNode.action?.type === 'set_variable') {
          const payload = currentNode.action.payload;
          await this.botConversationModel.updateOne(
            { _id: conversation._id },
            {
              $set: {
                [`flowVariables.${payload.variable}`]:
                  payload.value === '{{input}}'
                    ? userMessage
                    : payload.value,
              },
            },
          );
        }
        nextNodeId = currentNode.nextNodeId;

        // Advance to next node and process it
        if (nextNodeId) {
          const nextNode = nodes.find((n) => n.id === nextNodeId);
          if (nextNode) {
            await this.botConversationModel.updateOne(
              { _id: conversation._id },
              { $set: { currentNodeId: nextNode.id } },
            );
            return this.executeNode(
              { ...conversation, currentNodeId: nextNode.id } as any,
              userMessage,
            );
          }
        }
        break;
      }
    }

    // Check if flow is completed (no next node)
    if (!nextNodeId) {
      await this.botConversationModel.updateOne(
        { _id: conversation._id },
        {
          $set: { currentFlowId: null, currentNodeId: null },
        },
      );
      return {
        response: response ?? '',
        contentType,
        richMedia,
        flowCompleted: true,
      };
    }

    // Update current node for next interaction
    await this.botConversationModel.updateOne(
      { _id: conversation._id },
      { $set: { currentNodeId: nextNodeId } },
    );

    return {
      response: response ?? '',
      contentType,
      richMedia,
      flowCompleted: false,
    };
  }

  async startFlow(
    conversationId: string,
    flowId: number,
  ): Promise<void> {
    const flow = await this.prisma.chatbotFlow.findUnique({
      where: { id: flowId },
    });

    if (!flow || !flow.nodes) return;

    const nodes = flow.nodes as unknown as FlowNode[];
    const startNode = nodes[0];

    if (!startNode) return;

    await this.botConversationModel.updateOne(
      { sessionId: conversationId },
      {
        $set: {
          currentFlowId: flowId,
          currentNodeId: startNode.id,
          flowVariables: {},
        },
      },
    );
  }
}
