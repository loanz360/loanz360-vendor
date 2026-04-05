'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Brain,
  Sparkles,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ArrowRight,
  Lightbulb,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Tag,
  FileText,
  Link
} from 'lucide-react'
import { toast } from 'sonner'

interface AIInsightsPanelProps {
  ticketId: string
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
  subject: string
  description: string
  currentCategory?: string
  currentPriority?: string
  onApplySuggestion?: (type: string, value: any) => void
}

interface TicketInsights {
  classification: {
    category: string
    priority: string
    confidence: number
    reasoning: string
  }
  sentiment: {
    score: number
    label: string
    emotions: string[]
    urgency_indicators: string[]
  }
  suggestions: Array<{
    type: string
    id: string
    title: string
    content: string
    confidence: number
    source: string
  }>
  similar_tickets: Array<{
    id: string
    source: string
    subject: string
    similarity_score: number
    resolution?: string
    category: string
  }>
  auto_tags: string[]
  estimated_complexity: string
  recommended_actions: string[]
}

export function AIInsightsPanel({
  ticketId,
  ticketSource,
  subject,
  description,
  currentCategory,
  currentPriority,
  onApplySuggestion
}: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<TicketInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchInsights()
  }, [ticketId, ticketSource])

  const fetchInsights = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          ticket_id: ticketId,
          ticket_source: ticketSource,
          subject,
          description
        })
      })

      if (response.ok) {
        const data = await response.json()

        // Also fetch auto-tags
        const tagsResponse = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'auto_tag',
            ticket_id: ticketId,
            ticket_source: ticketSource,
            subject,
            description
          })
        })

        let autoTags: string[] = []
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json()
          autoTags = tagsData.tags || []
        }

        setInsights({
          ...data.analysis,
          auto_tags: autoTags,
          estimated_complexity: getComplexityFromInsights(data.analysis),
          recommended_actions: getRecommendedActions(data.analysis)
        })
      }
    } catch (error) {
      console.error('Failed to fetch AI insights:', error)
    } finally {
      setLoading(false)
    }
  }

  const getComplexityFromInsights = (analysis: any): string => {
    const score = analysis.sentiment?.score || 0.5
    const hasSimilar = (analysis.similar_tickets?.length || 0) > 0

    if (score < 0.3 && !hasSimilar) return 'high'
    if (score < 0.5 || !hasSimilar) return 'medium'
    return 'low'
  }

  const getRecommendedActions = (analysis: any): string[] => {
    const actions: string[] = []

    if (analysis.sentiment?.urgency_indicators?.length > 0) {
      actions.push('Prioritize response due to urgency indicators')
    }

    if (analysis.similar_tickets?.length > 0) {
      actions.push('Review similar resolved tickets for solutions')
    }

    if (analysis.suggestions?.length > 0) {
      actions.push('Use suggested responses to speed up resolution')
    }

    if (analysis.classification?.confidence < 0.7) {
      actions.push('Verify category classification manually')
    }

    return actions
  }

  const applyClassification = async () => {
    setApplying('classification')
    try {
      const response = await fetch('/api/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          ticket_source: ticketSource,
          apply_classification: true,
          apply_priority: true
        })
      })

      if (response.ok) {
        toast.success('AI classification applied')
        onApplySuggestion?.('classification', insights?.classification)
      } else {
        toast.error('Failed to apply classification')
      }
    } catch (error) {
      toast.error('Failed to apply classification')
    } finally {
      setApplying(null)
    }
  }

  const applyTags = async () => {
    setApplying('tags')
    try {
      const response = await fetch('/api/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          ticket_source: ticketSource,
          apply_tags: true
        })
      })

      if (response.ok) {
        toast.success('AI tags applied')
        onApplySuggestion?.('tags', insights?.auto_tags)
      } else {
        toast.error('Failed to apply tags')
      }
    } catch (error) {
      toast.error('Failed to apply tags')
    } finally {
      setApplying(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const getSentimentColor = (score: number): string => {
    if (score >= 0.6) return 'text-green-600'
    if (score >= 0.4) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSentimentBg = (score: number): string => {
    if (score >= 0.6) return 'bg-green-100'
    if (score >= 0.4) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-green-100 text-green-700">High Confidence</Badge>
    if (confidence >= 0.6) return <Badge className="bg-yellow-100 text-yellow-700">Medium Confidence</Badge>
    return <Badge className="bg-red-100 text-red-700">Low Confidence</Badge>
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Analyzing ticket with AI...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!insights) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Unable to generate AI insights</p>
            <Button variant="outline" onClick={fetchInsights} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>AI Insights</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchInsights}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Powered by intelligent ticket analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            <TabsTrigger value="similar">Similar</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Classification */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Classification
                </h4>
                {getConfidenceBadge(insights.classification.confidence)}
              </div>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Category:</span>
                  <Badge variant="outline">{insights.classification.category}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Priority:</span>
                  <Badge variant={
                    insights.classification.priority === 'urgent' ? 'destructive' :
                    insights.classification.priority === 'high' ? 'default' : 'secondary'
                  }>
                    {insights.classification.priority}
                  </Badge>
                </div>
                {currentCategory !== insights.classification.category && (
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    onClick={applyClassification}
                    disabled={applying === 'classification'}
                  >
                    {applying === 'classification' ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Apply Classification
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Sentiment */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Sentiment Analysis
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${getSentimentBg(insights.sentiment.score)}`}>
                    {insights.sentiment.score >= 0.5 ? (
                      <ThumbsUp className={`h-4 w-4 ${getSentimentColor(insights.sentiment.score)}`} />
                    ) : (
                      <ThumbsDown className={`h-4 w-4 ${getSentimentColor(insights.sentiment.score)}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize">{insights.sentiment.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {Math.round(insights.sentiment.score * 100)}%
                      </span>
                    </div>
                    <Progress value={insights.sentiment.score * 100} className="h-2" />
                  </div>
                </div>

                {insights.sentiment.emotions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {insights.sentiment.emotions.map((emotion, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {emotion}
                      </Badge>
                    ))}
                  </div>
                )}

                {insights.sentiment.urgency_indicators.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                    <div className="flex items-center gap-2 text-orange-700 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Urgency Detected</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {insights.sentiment.urgency_indicators.map((indicator, i) => (
                        <span key={i} className="text-xs text-orange-600">
                          "{indicator}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Auto Tags */}
            {insights.auto_tags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Suggested Tags
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={applyTags}
                    disabled={applying === 'tags'}
                  >
                    {applying === 'tags' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Apply</>
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {insights.auto_tags.map((tag, i) => (
                    <Badge key={i} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Complexity */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated Complexity:</span>
                <Badge variant={
                  insights.estimated_complexity === 'high' ? 'destructive' :
                  insights.estimated_complexity === 'medium' ? 'default' : 'secondary'
                }>
                  {insights.estimated_complexity}
                </Badge>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-3 mt-4">
            {insights.suggestions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No response suggestions available</p>
              </div>
            ) : (
              insights.suggestions.map((suggestion, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {suggestion.type === 'canned_response' ? (
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-green-500" />
                      )}
                      <span className="font-medium text-sm">{suggestion.title}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(suggestion.confidence * 100)}% match
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {suggestion.content}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(suggestion.content)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    {suggestion.type === 'article' && (
                      <Button variant="ghost" size="sm">
                        <Link className="h-3 w-3 mr-1" />
                        View Article
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="similar" className="space-y-3 mt-4">
            {insights.similar_tickets.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No similar tickets found</p>
              </div>
            ) : (
              insights.similar_tickets.map((ticket, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{ticket.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {ticket.source}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {ticket.category}
                        </Badge>
                      </div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700">
                      {Math.round(ticket.similarity_score * 100)}% similar
                    </Badge>
                  </div>
                  {ticket.resolution && (
                    <div className="bg-green-50 border border-green-200 rounded p-2 mt-2">
                      <div className="flex items-center gap-1 text-green-700 text-xs font-medium mb-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Resolution
                      </div>
                      <p className="text-sm text-green-800 line-clamp-2">
                        {ticket.resolution}
                      </p>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="w-full">
                    View Ticket
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="actions" className="space-y-3 mt-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Recommended Actions
              </h4>
              {insights.recommended_actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No specific actions recommended</p>
              ) : (
                <ul className="space-y-2">
                  {insights.recommended_actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={applyClassification}>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Apply AI Category
                </Button>
                <Button variant="outline" size="sm" onClick={applyTags}>
                  <Tag className="h-4 w-4 mr-1" />
                  Apply AI Tags
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
