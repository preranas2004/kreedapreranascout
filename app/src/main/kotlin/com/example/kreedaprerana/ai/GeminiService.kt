package com.example.kreedaprerana.ai

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content
import com.example.kreedaprerana.data.Trial

class GeminiService(apiKey: String) {
    private val model = GenerativeModel(
        modelName = "gemini-1.5-flash",
        apiKey = apiKey
    )

    suspend fun analyzePerformance(athleteName: String, trials: List<Trial>): String? {
        if (trials.isEmpty()) return "No trial data yet."
        
        val trialData = trials.joinToString("\n") { 
            "${it.trialType}: ${it.value} (${if(it.trialType == "Sprint") "s" else "m"})" 
        }

        val prompt = """
            Analyze the following sports trial data for $athleteName:
            $trialData
            
            Based on these physical milestones, provide a brief "Talent Scout" report:
            1. What is their strongest area?
            2. How does this compare to national school benchmarks for their age?
            3. A specific training recommendation to reach the next milestone.
            Keep it encouraging and professional.
        """.trimIndent()

        return try {
            val response = model.generateContent(prompt)
            response.text
        } catch (e: Exception) {
            "Analysis unavailable: ${e.message}"
        }
    }
}
