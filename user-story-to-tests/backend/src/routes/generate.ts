import express from 'express'
import { GroqClient } from '../llm/groqClient'
import { GenerateRequestSchema, GenerateResponseSchema, GenerateResponse } from '../schemas'
import { SYSTEM_PROMPT, buildPrompt } from '../prompt'

export const generateRouter = express.Router()

generateRouter.post('/', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    // Validate request body (allow categories)
    const validationResult = GenerateRequestSchema.safeParse(req.body)
    
    if (!validationResult.success) {
      res.status(400).json({
        error: `Validation error: ${validationResult.error.message}`
      })
      return
    }

    const request = validationResult.data
    const categories: string[] = Array.isArray(req.body.categories) ? req.body.categories : []

    // Build prompts
    const userPrompt = buildPrompt(request, categories)

    // Create GroqClient instance here to ensure env vars are loaded
    const groqClient = new GroqClient()

    // Generate tests using Groq
    try {
      const groqResponse = await groqClient.generateTests(SYSTEM_PROMPT, userPrompt)
      
      // Parse the JSON content
      let parsedResponse: GenerateResponse
      try {
        parsedResponse = JSON.parse(groqResponse.content)
      } catch (parseError) {
        res.status(502).json({
          error: 'LLM returned invalid JSON format',
          raw: groqResponse.content
        })
        return
      }

      // If parser succeeds, attempt to group by suiteCategory
      const testsBySuite: Record<string, any[]> = {}
      const requested = Array.isArray(categories) && categories.length ? categories : ['Uncategorized']

      if (Array.isArray(parsedResponse?.cases)) {
        parsedResponse.cases.forEach((c: any) => {
          const suite = (c.suiteCategory && String(c.suiteCategory).trim()) || 'Uncategorized'
          if (!testsBySuite[suite]) testsBySuite[suite] = []
          testsBySuite[suite].push(c)
        })

        // Ensure requested categories exist even if empty
        requested.forEach((cat: string) => {
          if (!testsBySuite[cat]) testsBySuite[cat] = []
        })
      } else {
        testsBySuite['All'] = [ parsedResponse ?? groqResponse.content ]
      }

      // Validate the response schema (without suiteCategory requirement)
      const responseValidation = GenerateResponseSchema.safeParse({
        cases: parsedResponse?.cases ?? [],
        model: parsedResponse?.model ?? undefined,
        promptTokens: parsedResponse?.promptTokens ?? groqResponse.promptTokens ?? 0,
        completionTokens: parsedResponse?.completionTokens ?? groqResponse.completionTokens ?? 0
      })

      if (!responseValidation.success) {
        // still return grouped results but warn
        res.json({
          warning: 'LLM response schema did not fully validate, returning grouped output where possible',
          raw: groqResponse.content,
          testsBySuite,
          model: groqResponse.model,
          promptTokens: groqResponse.promptTokens,
          completionTokens: groqResponse.completionTokens
        })
        return
      }

      // Add token usage info if available
      const finalResponse = {
        ...responseValidation.data,
        testsBySuite,
        model: groqResponse.model,
        promptTokens: groqResponse.promptTokens,
        completionTokens: groqResponse.completionTokens
      }

      res.json(finalResponse)
    } catch (llmError) {
      console.error('LLM error:', llmError)
      res.status(502).json({
        error: 'Failed to generate tests from LLM service'
      })
      return
    }
  } catch (error) {
    console.error('Error in generate route:', error)
    res.status(500).json({
      error: 'Internal server error'
    })
  }
})