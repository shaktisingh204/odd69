'use server'

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import api from '@/services/api';

const CHATBOT_PATH = '/dashboard/chatbot';

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILES
// ═══════════════════════════════════════════════════════════════════════════════

export async function getChatbotProfiles() {
    try {
        const profiles = await prisma.chatbotProfile.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: profiles };
    } catch (error) {
        console.error('getChatbotProfiles error:', error);
        return { success: false, error: 'Failed to fetch chatbot profiles' };
    }
}

export async function getChatbotProfile(id: string) {
    try {
        const profile = await prisma.chatbotProfile.findUnique({
            where: { id: parseInt(id) },
        });
        if (!profile) return { success: false, error: 'Profile not found' };
        return { success: true, data: profile };
    } catch (error) {
        console.error('getChatbotProfile error:', error);
        return { success: false, error: 'Failed to fetch chatbot profile' };
    }
}

export async function createChatbotProfile(data: any) {
    try {
        const profile = await prisma.chatbotProfile.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: profile };
    } catch (error) {
        console.error('createChatbotProfile error:', error);
        return { success: false, error: 'Failed to create chatbot profile' };
    }
}

export async function updateChatbotProfile(id: string, data: any) {
    try {
        const profile = await prisma.chatbotProfile.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: profile };
    } catch (error) {
        console.error('updateChatbotProfile error:', error);
        return { success: false, error: 'Failed to update chatbot profile' };
    }
}

export async function deleteChatbotProfile(id: string) {
    try {
        await prisma.chatbotProfile.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteChatbotProfile error:', error);
        return { success: false, error: 'Failed to delete chatbot profile' };
    }
}

export async function toggleChatbotProfile(id: string) {
    try {
        const profile = await prisma.chatbotProfile.findUnique({ where: { id: parseInt(id) } });
        if (!profile) return { success: false, error: 'Profile not found' };
        const updated = await prisma.chatbotProfile.update({
            where: { id: parseInt(id) },
            data: { isEnabled: !profile.isEnabled },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: updated };
    } catch (error) {
        console.error('toggleChatbotProfile error:', error);
        return { success: false, error: 'Failed to toggle chatbot profile' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHANNELS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getChannelConfigs() {
    try {
        const configs = await prisma.chatbotChannelConfig.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: configs };
    } catch (error) {
        console.error('getChannelConfigs error:', error);
        return { success: false, error: 'Failed to fetch channel configs' };
    }
}

export async function createChannelConfig(data: any) {
    try {
        const config = await prisma.chatbotChannelConfig.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: config };
    } catch (error) {
        console.error('createChannelConfig error:', error);
        return { success: false, error: 'Failed to create channel config' };
    }
}

export async function updateChannelConfig(id: string, data: any) {
    try {
        const config = await prisma.chatbotChannelConfig.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: config };
    } catch (error) {
        console.error('updateChannelConfig error:', error);
        return { success: false, error: 'Failed to update channel config' };
    }
}

export async function deleteChannelConfig(id: string) {
    try {
        await prisma.chatbotChannelConfig.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteChannelConfig error:', error);
        return { success: false, error: 'Failed to delete channel config' };
    }
}

export async function toggleChannelConfig(id: string) {
    try {
        const config = await prisma.chatbotChannelConfig.findUnique({ where: { id: parseInt(id) } });
        if (!config) return { success: false, error: 'Channel config not found' };
        const updated = await prisma.chatbotChannelConfig.update({
            where: { id: parseInt(id) },
            data: { isEnabled: !config.isEnabled },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: updated };
    } catch (error) {
        console.error('toggleChannelConfig error:', error);
        return { success: false, error: 'Failed to toggle channel config' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE — CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export async function getKBCategories() {
    try {
        const categories = await prisma.knowledgeCategory.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { articles: true } } },
        });
        return { success: true, data: categories };
    } catch (error) {
        console.error('getKBCategories error:', error);
        return { success: false, error: 'Failed to fetch KB categories' };
    }
}

export async function createKBCategory(data: any) {
    try {
        const category = await prisma.knowledgeCategory.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: category };
    } catch (error) {
        console.error('createKBCategory error:', error);
        return { success: false, error: 'Failed to create KB category' };
    }
}

export async function updateKBCategory(id: string, data: any) {
    try {
        const category = await prisma.knowledgeCategory.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: category };
    } catch (error) {
        console.error('updateKBCategory error:', error);
        return { success: false, error: 'Failed to update KB category' };
    }
}

export async function deleteKBCategory(id: string) {
    try {
        await prisma.knowledgeCategory.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteKBCategory error:', error);
        return { success: false, error: 'Failed to delete KB category' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE — ARTICLES
// ═══════════════════════════════════════════════════════════════════════════════

export async function getKBArticles(
    categoryId?: string,
    search?: string,
    page = 1,
    limit = 20,
) {
    try {
        const skip = (page - 1) * limit;
        const where: any = {};
        if (categoryId) where.categoryId = parseInt(categoryId);
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [articles, total] = await Promise.all([
            prisma.knowledgeArticle.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' },
                include: { category: true },
            }),
            prisma.knowledgeArticle.count({ where }),
        ]);
        return { success: true, data: articles, total };
    } catch (error) {
        console.error('getKBArticles error:', error);
        return { success: false, error: 'Failed to fetch KB articles' };
    }
}

export async function getKBArticle(id: string) {
    try {
        const article = await prisma.knowledgeArticle.findUnique({
            where: { id: parseInt(id) },
            include: { category: true, versions: { orderBy: { createdAt: 'desc' } } },
        });
        if (!article) return { success: false, error: 'Article not found' };
        return { success: true, data: article };
    } catch (error) {
        console.error('getKBArticle error:', error);
        return { success: false, error: 'Failed to fetch KB article' };
    }
}

export async function createKBArticle(data: any) {
    try {
        const article = await prisma.knowledgeArticle.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: article };
    } catch (error) {
        console.error('createKBArticle error:', error);
        return { success: false, error: 'Failed to create KB article' };
    }
}

export async function updateKBArticle(id: string, data: any) {
    try {
        const existing = await prisma.knowledgeArticle.findUnique({ where: { id: parseInt(id) } });
        if (!existing) return { success: false, error: 'Article not found' };

        // Create a version snapshot before updating
        await prisma.knowledgeArticleVersion.create({
            data: {
                articleId: parseInt(id),
                title: existing.title,
                content: existing.content,
                version: existing.version,
            },
        });

        const article = await prisma.knowledgeArticle.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: article };
    } catch (error) {
        console.error('updateKBArticle error:', error);
        return { success: false, error: 'Failed to update KB article' };
    }
}

export async function deleteKBArticle(id: string) {
    try {
        await prisma.knowledgeArticle.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteKBArticle error:', error);
        return { success: false, error: 'Failed to delete KB article' };
    }
}

export async function getArticleVersions(articleId: string) {
    try {
        const versions = await prisma.knowledgeArticleVersion.findMany({
            where: { articleId: parseInt(articleId) },
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: versions };
    } catch (error) {
        console.error('getArticleVersions error:', error);
        return { success: false, error: 'Failed to fetch article versions' };
    }
}

export async function restoreArticleVersion(versionId: string) {
    try {
        const version = await prisma.knowledgeArticleVersion.findUnique({
            where: { id: parseInt(versionId) },
        });
        if (!version) return { success: false, error: 'Version not found' };

        const article = await prisma.knowledgeArticle.update({
            where: { id: version.articleId },
            data: {
                title: version.title,
                content: version.content,
            },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: article };
    } catch (error) {
        console.error('restoreArticleVersion error:', error);
        return { success: false, error: 'Failed to restore article version' };
    }
}

export async function searchKB(query: string) {
    try {
        const articles = await prisma.knowledgeArticle.findMany({
            where: {
                OR: [
                    { title: { contains: query, mode: 'insensitive' } },
                    { content: { contains: query, mode: 'insensitive' } },
                    { tags: { has: query } },
                ],
            },
            orderBy: { updatedAt: 'desc' },
            take: 50,
            include: { category: true },
        });
        return { success: true, data: articles };
    } catch (error) {
        console.error('searchKB error:', error);
        return { success: false, error: 'Failed to search knowledge base' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTENTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getIntents() {
    try {
        const intents = await prisma.chatbotIntent.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { trainingPhrases: true } } },
        });
        return { success: true, data: intents };
    } catch (error) {
        console.error('getIntents error:', error);
        return { success: false, error: 'Failed to fetch intents' };
    }
}

export async function getIntent(id: string) {
    try {
        const intent = await prisma.chatbotIntent.findUnique({
            where: { id: parseInt(id) },
            include: { trainingPhrases: { orderBy: { createdAt: 'desc' } } },
        });
        if (!intent) return { success: false, error: 'Intent not found' };
        return { success: true, data: intent };
    } catch (error) {
        console.error('getIntent error:', error);
        return { success: false, error: 'Failed to fetch intent' };
    }
}

export async function createIntent(data: any) {
    try {
        const intent = await prisma.chatbotIntent.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: intent };
    } catch (error) {
        console.error('createIntent error:', error);
        return { success: false, error: 'Failed to create intent' };
    }
}

export async function updateIntent(id: string, data: any) {
    try {
        const intent = await prisma.chatbotIntent.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: intent };
    } catch (error) {
        console.error('updateIntent error:', error);
        return { success: false, error: 'Failed to update intent' };
    }
}

export async function deleteIntent(id: string) {
    try {
        await prisma.chatbotIntent.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteIntent error:', error);
        return { success: false, error: 'Failed to delete intent' };
    }
}

export async function addTrainingPhrase(intentId: string, phrase: string) {
    try {
        const tp = await prisma.chatbotTrainingPhrase.create({
            data: { intentId: parseInt(intentId), phrase },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: tp };
    } catch (error) {
        console.error('addTrainingPhrase error:', error);
        return { success: false, error: 'Failed to add training phrase' };
    }
}

export async function deleteTrainingPhrase(id: string) {
    try {
        await prisma.chatbotTrainingPhrase.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteTrainingPhrase error:', error);
        return { success: false, error: 'Failed to delete training phrase' };
    }
}

export async function toggleIntent(id: string) {
    try {
        const intent = await prisma.chatbotIntent.findUnique({ where: { id: parseInt(id) } });
        if (!intent) return { success: false, error: 'Intent not found' };
        const updated = await prisma.chatbotIntent.update({
            where: { id: parseInt(id) },
            data: { isEnabled: !intent.isEnabled },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: updated };
    } catch (error) {
        console.error('toggleIntent error:', error);
        return { success: false, error: 'Failed to toggle intent' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITIES
// ═══════════════════════════════════════════════════════════════════════════════

export async function getEntities() {
    try {
        const entities = await prisma.chatbotEntity.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { synonyms: true } } },
        });
        return { success: true, data: entities };
    } catch (error) {
        console.error('getEntities error:', error);
        return { success: false, error: 'Failed to fetch entities' };
    }
}

export async function getEntity(id: string) {
    try {
        const entity = await prisma.chatbotEntity.findUnique({
            where: { id: parseInt(id) },
            include: { synonyms: { orderBy: { createdAt: 'desc' } } },
        });
        if (!entity) return { success: false, error: 'Entity not found' };
        return { success: true, data: entity };
    } catch (error) {
        console.error('getEntity error:', error);
        return { success: false, error: 'Failed to fetch entity' };
    }
}

export async function createEntity(data: any) {
    try {
        const entity = await prisma.chatbotEntity.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: entity };
    } catch (error) {
        console.error('createEntity error:', error);
        return { success: false, error: 'Failed to create entity' };
    }
}

export async function updateEntity(id: string, data: any) {
    try {
        const entity = await prisma.chatbotEntity.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: entity };
    } catch (error) {
        console.error('updateEntity error:', error);
        return { success: false, error: 'Failed to update entity' };
    }
}

export async function deleteEntity(id: string) {
    try {
        await prisma.chatbotEntity.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteEntity error:', error);
        return { success: false, error: 'Failed to delete entity' };
    }
}

export async function addSynonym(entityId: string, value: string, synonyms: string[]) {
    try {
        const synonym = await prisma.chatbotSynonym.create({
            data: { entityId: parseInt(entityId), value, synonyms },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: synonym };
    } catch (error) {
        console.error('addSynonym error:', error);
        return { success: false, error: 'Failed to add synonym' };
    }
}

export async function deleteSynonym(id: string) {
    try {
        await prisma.chatbotSynonym.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteSynonym error:', error);
        return { success: false, error: 'Failed to delete synonym' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export async function getResponseTemplates(
    intentId?: string,
    page = 1,
    limit = 20,
) {
    try {
        const skip = (page - 1) * limit;
        const where: any = {};
        if (intentId) where.intentId = intentId;

        const [templates, total] = await Promise.all([
            prisma.chatbotResponseTemplate.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' },
            }),
            prisma.chatbotResponseTemplate.count({ where }),
        ]);
        return { success: true, data: templates, total };
    } catch (error) {
        console.error('getResponseTemplates error:', error);
        return { success: false, error: 'Failed to fetch response templates' };
    }
}

export async function getResponseTemplate(id: string) {
    try {
        const template = await prisma.chatbotResponseTemplate.findUnique({
            where: { id: parseInt(id) },
        });
        if (!template) return { success: false, error: 'Response template not found' };
        return { success: true, data: template };
    } catch (error) {
        console.error('getResponseTemplate error:', error);
        return { success: false, error: 'Failed to fetch response template' };
    }
}

export async function createResponseTemplate(data: any) {
    try {
        const template = await prisma.chatbotResponseTemplate.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: template };
    } catch (error) {
        console.error('createResponseTemplate error:', error);
        return { success: false, error: 'Failed to create response template' };
    }
}

export async function updateResponseTemplate(id: string, data: any) {
    try {
        const template = await prisma.chatbotResponseTemplate.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: template };
    } catch (error) {
        console.error('updateResponseTemplate error:', error);
        return { success: false, error: 'Failed to update response template' };
    }
}

export async function deleteResponseTemplate(id: string) {
    try {
        await prisma.chatbotResponseTemplate.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteResponseTemplate error:', error);
        return { success: false, error: 'Failed to delete response template' };
    }
}

export async function toggleResponseTemplate(id: string) {
    try {
        const template = await prisma.chatbotResponseTemplate.findUnique({ where: { id: parseInt(id) } });
        if (!template) return { success: false, error: 'Response template not found' };
        const updated = await prisma.chatbotResponseTemplate.update({
            where: { id: parseInt(id) },
            data: { isEnabled: !template.isEnabled },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: updated };
    } catch (error) {
        console.error('toggleResponseTemplate error:', error);
        return { success: false, error: 'Failed to toggle response template' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-REPLY RULES
// ═══════════════════════════════════════════════════════════════════════════════

export async function getAutoReplyRules() {
    try {
        const rules = await prisma.chatbotAutoReplyRule.findMany({
            orderBy: { priority: 'asc' },
        });
        return { success: true, data: rules };
    } catch (error) {
        console.error('getAutoReplyRules error:', error);
        return { success: false, error: 'Failed to fetch auto-reply rules' };
    }
}

export async function createAutoReplyRule(data: any) {
    try {
        const rule = await prisma.chatbotAutoReplyRule.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: rule };
    } catch (error) {
        console.error('createAutoReplyRule error:', error);
        return { success: false, error: 'Failed to create auto-reply rule' };
    }
}

export async function updateAutoReplyRule(id: string, data: any) {
    try {
        const rule = await prisma.chatbotAutoReplyRule.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: rule };
    } catch (error) {
        console.error('updateAutoReplyRule error:', error);
        return { success: false, error: 'Failed to update auto-reply rule' };
    }
}

export async function deleteAutoReplyRule(id: string) {
    try {
        await prisma.chatbotAutoReplyRule.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteAutoReplyRule error:', error);
        return { success: false, error: 'Failed to delete auto-reply rule' };
    }
}

export async function toggleAutoReplyRule(id: string) {
    try {
        const rule = await prisma.chatbotAutoReplyRule.findUnique({ where: { id: parseInt(id) } });
        if (!rule) return { success: false, error: 'Auto-reply rule not found' };
        const updated = await prisma.chatbotAutoReplyRule.update({
            where: { id: parseInt(id) },
            data: { isEnabled: !rule.isEnabled },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: updated };
    } catch (error) {
        console.error('toggleAutoReplyRule error:', error);
        return { success: false, error: 'Failed to toggle auto-reply rule' };
    }
}

export async function reorderAutoReplyRules(orderedIds: string[]) {
    try {
        const updates = orderedIds.map((id, index) =>
            prisma.chatbotAutoReplyRule.update({
                where: { id: parseInt(id) },
                data: { priority: index },
            }),
        );
        await prisma.$transaction(updates);
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('reorderAutoReplyRules error:', error);
        return { success: false, error: 'Failed to reorder auto-reply rules' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK REPLIES
// ═══════════════════════════════════════════════════════════════════════════════

export async function getQuickReplySets() {
    try {
        const sets = await prisma.chatbotQuickReplySet.findMany({
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { replies: true } } },
        });
        return { success: true, data: sets };
    } catch (error) {
        console.error('getQuickReplySets error:', error);
        return { success: false, error: 'Failed to fetch quick reply sets' };
    }
}

export async function getQuickReplySet(id: string) {
    try {
        const set = await prisma.chatbotQuickReplySet.findUnique({
            where: { id: parseInt(id) },
            include: { replies: { orderBy: { sortOrder: 'asc' } } },
        });
        if (!set) return { success: false, error: 'Quick reply set not found' };
        return { success: true, data: set };
    } catch (error) {
        console.error('getQuickReplySet error:', error);
        return { success: false, error: 'Failed to fetch quick reply set' };
    }
}

export async function createQuickReplySet(data: any) {
    try {
        const set = await prisma.chatbotQuickReplySet.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: set };
    } catch (error) {
        console.error('createQuickReplySet error:', error);
        return { success: false, error: 'Failed to create quick reply set' };
    }
}

export async function deleteQuickReplySet(id: string) {
    try {
        await prisma.chatbotQuickReplySet.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteQuickReplySet error:', error);
        return { success: false, error: 'Failed to delete quick reply set' };
    }
}

export async function addQuickReply(setId: string, data: any) {
    try {
        const reply = await prisma.chatbotQuickReply.create({
            data: { ...data, setId: parseInt(setId) },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: reply };
    } catch (error) {
        console.error('addQuickReply error:', error);
        return { success: false, error: 'Failed to add quick reply' };
    }
}

export async function deleteQuickReply(id: string) {
    try {
        await prisma.chatbotQuickReply.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteQuickReply error:', error);
        return { success: false, error: 'Failed to delete quick reply' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOWS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getFlows() {
    try {
        const flows = await prisma.chatbotFlow.findMany({
            orderBy: { updatedAt: 'desc' },
        });
        return { success: true, data: flows };
    } catch (error) {
        console.error('getFlows error:', error);
        return { success: false, error: 'Failed to fetch flows' };
    }
}

export async function getFlow(id: string) {
    try {
        const flow = await prisma.chatbotFlow.findUnique({
            where: { id: parseInt(id) },
            include: { versions: { orderBy: { createdAt: 'desc' } } },
        });
        if (!flow) return { success: false, error: 'Flow not found' };
        return { success: true, data: flow };
    } catch (error) {
        console.error('getFlow error:', error);
        return { success: false, error: 'Failed to fetch flow' };
    }
}

export async function createFlow(data: any) {
    try {
        const flow = await prisma.chatbotFlow.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: flow };
    } catch (error) {
        console.error('createFlow error:', error);
        return { success: false, error: 'Failed to create flow' };
    }
}

export async function updateFlow(id: string, data: any) {
    try {
        const flow = await prisma.chatbotFlow.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: flow };
    } catch (error) {
        console.error('updateFlow error:', error);
        return { success: false, error: 'Failed to update flow' };
    }
}

export async function deleteFlow(id: string) {
    try {
        await prisma.chatbotFlow.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteFlow error:', error);
        return { success: false, error: 'Failed to delete flow' };
    }
}

export async function publishFlow(id: string) {
    try {
        const flow = await prisma.chatbotFlow.findUnique({ where: { id: parseInt(id) } });
        if (!flow) return { success: false, error: 'Flow not found' };

        // Create a version snapshot and mark flow as published
        await prisma.chatbotFlowVersion.create({
            data: {
                flowId: parseInt(id),
                version: flow.version + 1,
                nodes: flow.nodes ?? {},
            },
        });

        const updated = await prisma.chatbotFlow.update({
            where: { id: parseInt(id) },
            data: {
                isPublished: true,
                version: flow.version + 1,
            },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: updated };
    } catch (error) {
        console.error('publishFlow error:', error);
        return { success: false, error: 'Failed to publish flow' };
    }
}

export async function unpublishFlow(id: string) {
    try {
        const flow = await prisma.chatbotFlow.update({
            where: { id: parseInt(id) },
            data: { isPublished: false },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: flow };
    } catch (error) {
        console.error('unpublishFlow error:', error);
        return { success: false, error: 'Failed to unpublish flow' };
    }
}

export async function duplicateFlow(id: string) {
    try {
        const original = await prisma.chatbotFlow.findUnique({ where: { id: parseInt(id) } });
        if (!original) return { success: false, error: 'Flow not found' };

        const flow = await prisma.chatbotFlow.create({
            data: {
                name: `${original.name} (Copy)`,
                description: original.description,
                triggerType: original.triggerType,
                triggerValue: original.triggerValue ?? undefined,
                nodes: original.nodes as any,
                variables: original.variables as any ?? undefined,
                channels: original.channels,
                isPublished: false,
                isDraft: true,
                version: 1,
            },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: flow };
    } catch (error) {
        console.error('duplicateFlow error:', error);
        return { success: false, error: 'Failed to duplicate flow' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEGMENTS, BLACKLIST & WHITELIST
// ═══════════════════════════════════════════════════════════════════════════════

export async function getChatbotSegments() {
    try {
        const segments = await prisma.chatbotUserSegment.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: segments };
    } catch (error) {
        console.error('getChatbotSegments error:', error);
        return { success: false, error: 'Failed to fetch chatbot segments' };
    }
}

export async function createChatbotSegment(data: any) {
    try {
        const segment = await prisma.chatbotUserSegment.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: segment };
    } catch (error) {
        console.error('createChatbotSegment error:', error);
        return { success: false, error: 'Failed to create chatbot segment' };
    }
}

export async function updateChatbotSegment(id: string, data: any) {
    try {
        const segment = await prisma.chatbotUserSegment.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: segment };
    } catch (error) {
        console.error('updateChatbotSegment error:', error);
        return { success: false, error: 'Failed to update chatbot segment' };
    }
}

export async function deleteChatbotSegment(id: string) {
    try {
        await prisma.chatbotUserSegment.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteChatbotSegment error:', error);
        return { success: false, error: 'Failed to delete chatbot segment' };
    }
}

export async function getBlacklist(page = 1, limit = 50) {
    try {
        const skip = (page - 1) * limit;
        const [entries, total] = await Promise.all([
            prisma.chatbotUserBlacklist.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.chatbotUserBlacklist.count(),
        ]);
        return { success: true, data: entries, total };
    } catch (error) {
        console.error('getBlacklist error:', error);
        return { success: false, error: 'Failed to fetch blacklist' };
    }
}

export async function addToBlacklist(userId: string, reason?: string) {
    try {
        const entry = await prisma.chatbotUserBlacklist.create({
            data: { userId: parseInt(userId), reason },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: entry };
    } catch (error) {
        console.error('addToBlacklist error:', error);
        return { success: false, error: 'Failed to add user to blacklist' };
    }
}

export async function removeFromBlacklist(id: string) {
    try {
        await prisma.chatbotUserBlacklist.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('removeFromBlacklist error:', error);
        return { success: false, error: 'Failed to remove user from blacklist' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESCALATION RULES
// ═══════════════════════════════════════════════════════════════════════════════

export async function getEscalationRules() {
    try {
        const rules = await prisma.chatbotEscalationRule.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: rules };
    } catch (error) {
        console.error('getEscalationRules error:', error);
        return { success: false, error: 'Failed to fetch escalation rules' };
    }
}

export async function createEscalationRule(data: any) {
    try {
        const rule = await prisma.chatbotEscalationRule.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: rule };
    } catch (error) {
        console.error('createEscalationRule error:', error);
        return { success: false, error: 'Failed to create escalation rule' };
    }
}

export async function updateEscalationRule(id: string, data: any) {
    try {
        const rule = await prisma.chatbotEscalationRule.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: rule };
    } catch (error) {
        console.error('updateEscalationRule error:', error);
        return { success: false, error: 'Failed to update escalation rule' };
    }
}

export async function deleteEscalationRule(id: string) {
    try {
        await prisma.chatbotEscalationRule.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteEscalationRule error:', error);
        return { success: false, error: 'Failed to delete escalation rule' };
    }
}

export async function toggleEscalationRule(id: string) {
    try {
        const rule = await prisma.chatbotEscalationRule.findUnique({ where: { id: parseInt(id) } });
        if (!rule) return { success: false, error: 'Escalation rule not found' };
        const updated = await prisma.chatbotEscalationRule.update({
            where: { id: parseInt(id) },
            data: { isEnabled: !rule.isEnabled },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: updated };
    } catch (error) {
        console.error('toggleEscalationRule error:', error);
        return { success: false, error: 'Failed to toggle escalation rule' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GREETINGS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getGreetings() {
    try {
        const greetings = await prisma.chatbotGreeting.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: greetings };
    } catch (error) {
        console.error('getGreetings error:', error);
        return { success: false, error: 'Failed to fetch greetings' };
    }
}

export async function createGreeting(data: any) {
    try {
        const greeting = await prisma.chatbotGreeting.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: greeting };
    } catch (error) {
        console.error('createGreeting error:', error);
        return { success: false, error: 'Failed to create greeting' };
    }
}

export async function updateGreeting(id: string, data: any) {
    try {
        const greeting = await prisma.chatbotGreeting.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: greeting };
    } catch (error) {
        console.error('updateGreeting error:', error);
        return { success: false, error: 'Failed to update greeting' };
    }
}

export async function deleteGreeting(id: string) {
    try {
        await prisma.chatbotGreeting.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteGreeting error:', error);
        return { success: false, error: 'Failed to delete greeting' };
    }
}

export async function toggleGreeting(id: string) {
    try {
        const greeting = await prisma.chatbotGreeting.findUnique({ where: { id: parseInt(id) } });
        if (!greeting) return { success: false, error: 'Greeting not found' };
        const updated = await prisma.chatbotGreeting.update({
            where: { id: parseInt(id) },
            data: { isEnabled: !greeting.isEnabled },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: updated };
    } catch (error) {
        console.error('toggleGreeting error:', error);
        return { success: false, error: 'Failed to toggle greeting' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOWS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getWorkflows() {
    try {
        const workflows = await prisma.chatbotWorkflow.findMany({
            orderBy: { updatedAt: 'desc' },
        });
        return { success: true, data: workflows };
    } catch (error) {
        console.error('getWorkflows error:', error);
        return { success: false, error: 'Failed to fetch workflows' };
    }
}

export async function createWorkflow(data: any) {
    try {
        const workflow = await prisma.chatbotWorkflow.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: workflow };
    } catch (error) {
        console.error('createWorkflow error:', error);
        return { success: false, error: 'Failed to create workflow' };
    }
}

export async function updateWorkflow(id: string, data: any) {
    try {
        const workflow = await prisma.chatbotWorkflow.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: workflow };
    } catch (error) {
        console.error('updateWorkflow error:', error);
        return { success: false, error: 'Failed to update workflow' };
    }
}

export async function deleteWorkflow(id: string) {
    try {
        await prisma.chatbotWorkflow.delete({ where: { id: parseInt(id) } });
        revalidatePath(CHATBOT_PATH);
        return { success: true };
    } catch (error) {
        console.error('deleteWorkflow error:', error);
        return { success: false, error: 'Failed to delete workflow' };
    }
}

export async function toggleWorkflow(id: string) {
    try {
        const workflow = await prisma.chatbotWorkflow.findUnique({ where: { id: parseInt(id) } });
        if (!workflow) return { success: false, error: 'Workflow not found' };
        const updated = await prisma.chatbotWorkflow.update({
            where: { id: parseInt(id) },
            data: { isEnabled: !workflow.isEnabled },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: updated };
    } catch (error) {
        console.error('toggleWorkflow error:', error);
        return { success: false, error: 'Failed to toggle workflow' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// A/B TESTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getABTests() {
    try {
        const tests = await prisma.chatbotABTest.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: tests };
    } catch (error) {
        console.error('getABTests error:', error);
        return { success: false, error: 'Failed to fetch A/B tests' };
    }
}

export async function createABTest(data: any) {
    try {
        const test = await prisma.chatbotABTest.create({ data });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: test };
    } catch (error) {
        console.error('createABTest error:', error);
        return { success: false, error: 'Failed to create A/B test' };
    }
}

export async function updateABTest(id: string, data: any) {
    try {
        const test = await prisma.chatbotABTest.update({
            where: { id: parseInt(id) },
            data,
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: test };
    } catch (error) {
        console.error('updateABTest error:', error);
        return { success: false, error: 'Failed to update A/B test' };
    }
}

export async function startABTest(id: string) {
    try {
        const test = await prisma.chatbotABTest.update({
            where: { id: parseInt(id) },
            data: { status: 'RUNNING', startDate: new Date() },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: test };
    } catch (error) {
        console.error('startABTest error:', error);
        return { success: false, error: 'Failed to start A/B test' };
    }
}

export async function stopABTest(id: string) {
    try {
        const test = await prisma.chatbotABTest.update({
            where: { id: parseInt(id) },
            data: { status: 'COMPLETED', endDate: new Date() },
        });
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: test };
    } catch (error) {
        console.error('stopABTest error:', error);
        return { success: false, error: 'Failed to stop A/B test' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATIONS (via Backend API — data lives in MongoDB)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getConversations(params?: {
    status?: string;
    channel?: string;
    page?: number;
    limit?: number;
}) {
    try {
        const response = await api.get('/chatbot/conversations', { params });
        return { success: true, data: response.data.data, total: response.data.total };
    } catch (error) {
        console.error('getConversations error:', error);
        return { success: false, error: 'Failed to fetch conversations' };
    }
}

export async function getConversation(id: string) {
    try {
        const response = await api.get(`/chatbot/conversations/${id}`);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('getConversation error:', error);
        return { success: false, error: 'Failed to fetch conversation' };
    }
}

export async function takeoverConversation(id: string) {
    try {
        const response = await api.post(`/chatbot/conversations/${id}/takeover`);
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('takeoverConversation error:', error);
        return { success: false, error: 'Failed to take over conversation' };
    }
}

export async function closeConversation(id: string) {
    try {
        const response = await api.post(`/chatbot/conversations/${id}/close`);
        revalidatePath(CHATBOT_PATH);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('closeConversation error:', error);
        return { success: false, error: 'Failed to close conversation' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS (via Backend API)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getChatbotDashboard(params?: { from?: string; to?: string }) {
    try {
        const response = await api.get('/chatbot/analytics/dashboard', { params });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('getChatbotDashboard error:', error);
        return { success: false, error: 'Failed to fetch chatbot dashboard' };
    }
}

export async function getConversationAnalytics(params?: { from?: string; to?: string }) {
    try {
        const response = await api.get('/chatbot/analytics/conversations', { params });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('getConversationAnalytics error:', error);
        return { success: false, error: 'Failed to fetch conversation analytics' };
    }
}

export async function getIntentAnalytics(params?: { from?: string; to?: string }) {
    try {
        const response = await api.get('/chatbot/analytics/intents', { params });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('getIntentAnalytics error:', error);
        return { success: false, error: 'Failed to fetch intent analytics' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTING (via Backend API)
// ═══════════════════════════════════════════════════════════════════════════════

export async function simulateMessage(message: string, profileId?: string) {
    try {
        const response = await api.post('/chatbot/test/simulate', { message, profileId });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('simulateMessage error:', error);
        return { success: false, error: 'Failed to simulate message' };
    }
}

export async function testIntentMatch(message: string) {
    try {
        const response = await api.post('/chatbot/test/intent-match', { message });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('testIntentMatch error:', error);
        return { success: false, error: 'Failed to test intent match' };
    }
}

// ─── Chatwoot Config ────────────────────────────────────────────────────────

export async function getChatwootConfig() {
    try {
        const config = await prisma.chatwootConfig.findFirst();
        return { success: true, data: config };
    } catch (error) {
        console.error('getChatwootConfig error:', error);
        return { success: false, error: 'Failed to get Chatwoot config' };
    }
}

export async function updateChatwootConfig(data: {
    instanceUrl?: string;
    apiToken?: string;
    accountId?: number;
    agentBotToken?: string;
    webhookSecret?: string;
    autoSyncUsers?: boolean;
    defaultInboxId?: number;
    isEnabled?: boolean;
}) {
    try {
        const existing = await prisma.chatwootConfig.findFirst();
        let config;
        if (existing) {
            config = await prisma.chatwootConfig.update({
                where: { id: existing.id },
                data,
            });
        } else {
            config = await prisma.chatwootConfig.create({
                data: {
                    instanceUrl: data.instanceUrl || '',
                    apiToken: data.apiToken || '',
                    accountId: data.accountId || 0,
                    agentBotToken: data.agentBotToken,
                    webhookSecret: data.webhookSecret,
                    autoSyncUsers: data.autoSyncUsers ?? false,
                    defaultInboxId: data.defaultInboxId,
                    isEnabled: data.isEnabled ?? true,
                },
            });
        }
        revalidatePath('/dashboard/chatbot');
        return { success: true, data: config };
    } catch (error) {
        console.error('updateChatwootConfig error:', error);
        return { success: false, error: 'Failed to update Chatwoot config' };
    }
}

export async function testChatwootConnection() {
    try {
        const response = await api.post('/chatbot/chatwoot/test-connection');
        return { success: true, data: response.data };
    } catch (error) {
        console.error('testChatwootConnection error:', error);
        return { success: false, error: 'Failed to test connection' };
    }
}

export async function syncChatwootUsers() {
    try {
        const response = await api.post('/chatbot/chatwoot/sync-users');
        return { success: true, data: response.data };
    } catch (error) {
        console.error('syncChatwootUsers error:', error);
        return { success: false, error: 'Failed to sync users' };
    }
}

export async function getChatwootSyncStatus() {
    try {
        const response = await api.get('/chatbot/chatwoot/sync-status');
        return { success: true, data: response.data };
    } catch (error) {
        console.error('getChatwootSyncStatus error:', error);
        return { success: false, error: 'Failed to get sync status' };
    }
}
