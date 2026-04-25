import {
  createPendingGeneration,
  getProjectMessages,
  updateAssistantMessageFromClient,
} from '@/actions/project-message';
import { MAX_IMAGE_PAYLOAD_CHARS } from '@/ai/image/lib/api-utils';
import { MAX_REFERENCE_IMAGES } from '@/ai/image/lib/input-images';
import { createResultResponse } from '@/app/api/_utils/result-response';
import { auth } from '@/lib/auth';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_MESSAGE_BODY_BYTES = 48 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 4000;

const ImagePayloadSchema = z.string().min(1).max(MAX_IMAGE_PAYLOAD_CHARS);
const PendingGenerationParamsSchema = z
  .object({
    prompt: z.string().min(1).max(MAX_PROMPT_LENGTH),
    enhancedPrompt: z.string().max(MAX_PROMPT_LENGTH).optional(),
    style: z.string().max(80).optional(),
    aspectRatio: z.string().min(1).max(20).optional(),
    model: z.string().min(1).max(80).optional(),
    imageQuality: z.enum(['1K', '2K', '4K']).optional(),
  })
  .strict();

const CreatePendingGenerationSchema = z
  .object({
    action: z.literal('create-pending-generation'),
    projectId: z.string().min(1),
    data: z
      .object({
        content: z.string().min(1).max(MAX_PROMPT_LENGTH),
        inputImages: z
          .array(ImagePayloadSchema)
          .max(MAX_REFERENCE_IMAGES)
          .optional(),
        generationParams: PendingGenerationParamsSchema,
      })
      .strict(),
  })
  .strict();

const UpdateAssistantMessageSchema = z
  .object({
    action: z.literal('update-assistant-message'),
    messageId: z.string().min(1),
    data: z.union([
      z
        .object({
          status: z.literal('generating'),
          content: z.string().max(MAX_PROMPT_LENGTH).optional(),
          outputImage: z.null().optional(),
          creditsUsed: z.null().optional(),
          generationTime: z.null().optional(),
          errorMessage: z.null().optional(),
        })
        .strict(),
      z
        .object({
          status: z.literal('failed'),
          content: z.string().max(MAX_PROMPT_LENGTH).optional(),
          errorMessage: z.string().max(MAX_PROMPT_LENGTH).nullable().optional(),
        })
        .strict(),
    ]),
  })
  .strict();

async function readLimitedJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_MESSAGE_BODY_BYTES) {
    throw new Error('Request body too large');
  }

  const bodyText = await request.text();
  if (Buffer.byteLength(bodyText, 'utf8') > MAX_MESSAGE_BODY_BYTES) {
    throw new Error('Request body too large');
  }

  return JSON.parse(bodyText);
}

async function verifyMutationRateLimit(request: Request, action: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const rateLimitResult = await applyRateLimit({
    key: `image-messages:${session.user.id}:${action}`,
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: '请求过于频繁，请稍后再试' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');

  if (!projectId) {
    return createResultResponse({
      success: false,
      error: 'Project not found',
      data: [],
    });
  }

  return createResultResponse(await getProjectMessages(projectId));
}

export async function POST(request: Request) {
  try {
    const body = await readLimitedJson(request);
    const parsed = CreatePendingGenerationSchema.safeParse(body);

    if (!parsed.success) {
      return createResultResponse({
        success: false,
        error: 'Invalid action',
      });
    }

    const rateLimitResponse = await verifyMutationRateLimit(
      request,
      parsed.data.action
    );
    if (rateLimitResponse) return rateLimitResponse;

    return createResultResponse(
      await createPendingGeneration(parsed.data.projectId, parsed.data.data)
    );
  } catch (error) {
    return createResultResponse({
      success: false,
      error:
        error instanceof Error && error.message === 'Request body too large'
          ? 'Request body too large'
          : 'Invalid request body',
    });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readLimitedJson(request);
    const parsed = UpdateAssistantMessageSchema.safeParse(body);

    if (!parsed.success) {
      return createResultResponse({
        success: false,
        error: 'Invalid action',
      });
    }

    const rateLimitResponse = await verifyMutationRateLimit(
      request,
      parsed.data.action
    );
    if (rateLimitResponse) return rateLimitResponse;

    return createResultResponse(
      await updateAssistantMessageFromClient(
        parsed.data.messageId,
        parsed.data.data
      )
    );
  } catch (error) {
    return createResultResponse({
      success: false,
      error:
        error instanceof Error && error.message === 'Request body too large'
          ? 'Request body too large'
          : 'Invalid request body',
    });
  }
}
