package com.example.kreedaprerana

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.room.Room
import com.example.kreedaprerana.data.Athlete
import com.example.kreedaprerana.data.SportsDatabase
import com.example.kreedaprerana.data.Trial
import com.example.kreedaprerana.ai.GeminiService
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import java.util.Locale

class MainActivity : ComponentActivity() {
    private lateinit var db: SportsDatabase
    private val geminiService by lazy { 
        GeminiService(BuildConfig.GEMINI_API_KEY) 
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        db = Room.databaseBuilder(
            applicationContext,
            SportsDatabase::class.java, "sports-db"
        ).build()

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF1E88E5),
                    secondary = Color(0xFFFBC02D),
                    tertiary = Color(0xFF43A047)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AppNavigation(db, geminiService)
                }
            }
        }
    }
}

@Composable
fun AppNavigation(db: SportsDatabase, geminiService: GeminiService) {
    val navController = rememberNavController()
    val dao = db.sportsDao()
    
    NavHost(navController = navController, startDestination = "dashboard") {
        composable("dashboard") {
            DashboardScreen(dao) { athleteId ->
                navController.navigate("profile/$athleteId")
            }
        }
        composable("profile/{athleteId}") { backStackEntry ->
            val athleteId = backStackEntry.arguments?.getString("athleteId")?.toInt() ?: 0
            ProfileScreen(athleteId, dao, geminiService) {
                navController.navigate("logger/$athleteId")
            }
        }
        composable("logger/{athleteId}") { backStackEntry ->
            val athleteId = backStackEntry.arguments?.getString("athleteId")?.toInt() ?: 0
            TrialLoggerScreen(athleteId, dao) {
                navController.popBackStack()
            }
        }
    }
}

@Composable
fun DashboardScreen(dao: com.example.kreedaprerana.data.SportsDao, onAthleteClick: (Int) -> Unit) {
    val athletes by dao.getAllAthletes().collectAsState(initial = emptyList())
    var showAddDialog by remember { mutableStateOf(false) }
    var showBatchDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Kreeda-Prerana Scout") },
                actions = {
                    IconButton(onClick = { showBatchDialog = true }) {
                        Icon(Icons.Default.List, "Batch Entry")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, "Add Athlete")
            }
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.padding(padding).fillMaxSize()) {
            item {
                Text("Active Athletes", modifier = Modifier.padding(16.dp), fontWeight = FontWeight.SemiBold)
            }
            items(athletes) { athlete ->
                ListItem(
                    headlineContent = { Text(athlete.name) },
                    supportingContent = { Text("${athlete.age} years • ${athlete.primarySport}") },
                    leadingContent = { Icon(Icons.Default.Person, null) },
                    modifier = Modifier.clickable { onAthleteClick(athlete.id) }
                )
            }
        }

        if (showBatchDialog) {
            var batchText by remember { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { showBatchDialog = false },
                title = { Text("Batch Entry (CSV Format)") },
                text = {
                    Column {
                        Text("Format: Name, Age, Sport (One per line)", fontSize = 12.sp)
                        TextField(
                            value = batchText,
                            onValueChange = { batchText = it },
                            modifier = Modifier.height(200.dp).fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        scope.launch {
                            batchText.lines().forEach { line ->
                                val parts = line.split(",")
                                if (parts.size >= 3) {
                                    dao.insertAthlete(Athlete(
                                        name = parts[0].trim(),
                                        age = parts[1].trim().toIntOrNull() ?: 12,
                                        primarySport = parts[2].trim()
                                    ))
                                }
                            }
                            showBatchDialog = false
                        }
                    }) { Text("Import Class") }
                }
            )
        }

        if (showAddDialog) {
            var name by remember { mutableStateOf("") }
            var age by remember { mutableStateOf("") }
            var sport by remember { mutableStateOf("") }

            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Register Athlete") },
                text = {
                    Column {
                        TextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth())
                        TextField(value = age, onValueChange = { age = it }, label = { Text("Age") }, modifier = Modifier.fillMaxWidth())
                        TextField(value = sport, onValueChange = { sport = it }, label = { Text("Primary Sport") }, modifier = Modifier.fillMaxWidth())
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        scope.launch {
                            dao.insertAthlete(Athlete(name = name, age = age.toIntOrNull() ?: 12, primarySport = sport))
                            showAddDialog = false
                        }
                    }) { Text("Save") }
                }
            )
        }
    }
}



@Composable
fun ProfileScreen(athleteId: Int, dao: com.example.kreedaprerana.data.SportsDao, gemini: GeminiService, onLogTrial: () -> Unit) {
    val trials by dao.getTrialsForAthlete(athleteId).collectAsState(initial = emptyList())
    var analysis by remember { mutableStateOf("Generating AI Analysis...") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(trials) {
        if (trials.isNotEmpty()) {
            analysis = gemini.analyzePerformance("Athlete", trials) ?: "Analysis failed."
        }
    }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(onClick = onLogTrial) {
                Icon(Icons.Default.PlayArrow, null)
                Spacer(Modifier.width(8.dp))
                Text("Log Trial")
            }
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.padding(padding).padding(16.dp)) {
            item {
                Text("Performance Profile", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(16.dp))
                
                // Talent Curve Graph
                Card(modifier = Modifier.fillMaxWidth().height(200.dp)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Talent Curve (Sprint Time)", fontSize = 12.sp, color = Color.Gray)
                        Spacer(Modifier.height(8.dp))
                        Box(Modifier.fillMaxSize()) {
                            androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
                                if (trials.size >= 2) {
                                    val sprintTrials = trials.filter { it.trialType == "100m Sprint" }.sortedBy { it.timestamp }
                                    if (sprintTrials.isNotEmpty()) {
                                        val maxVal = sprintTrials.maxOf { it.value }.toFloat()
                                        val minVal = sprintTrials.minOf { it.value }.toFloat()
                                        val range = (maxVal - minVal).coerceAtLeast(0.1f)
                                        
                                        val path = androidx.compose.ui.graphics.Path()
                                        sprintTrials.forEachIndexed { index, trial ->
                                            val x = index * (size.width / (sprintTrials.size - 1))
                                            val y = size.height - ((trial.value.toFloat() - minVal) / range * size.height)
                                            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
                                            drawCircle(Color(0xFF1E88E5), 8f, androidx.compose.ui.geometry.Offset(x, y))
                                        }
                                        drawPath(path, Color(0xFF1E88E5), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 4f))
                                    }
                                } else {
                                    // Empty state
                                    // draw simple axis
                                }
                            }
                        }
                    }
                }
                
                Spacer(Modifier.height(24.dp))
                Text("AI Scout Report", fontWeight = FontWeight.SemiBold)
                Card(modifier = Modifier.padding(vertical = 8.dp)) {
                    Text(analysis, modifier = Modifier.padding(16.dp), fontSize = 14.sp)
                }
                
                Spacer(Modifier.height(24.dp))
                Text("Historical Data", fontWeight = FontWeight.SemiBold)
            }
            items(trials) { trial ->
                ListItem(
                    headlineContent = { Text("${trial.trialType}: ${trial.value}") },
                    supportingContent = { Text(java.util.Date(trial.timestamp).toString()) }
                )
            }
        }
    }
}

@Composable
fun TrialLoggerScreen(athleteId: Int, dao: com.example.kreedaprerana.data.SportsDao, onComplete: () -> Unit) {
    var time by remember { mutableLongStateOf(0L) }
    var isRunning by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(isRunning) {
        if (isRunning) {
            val startTime = System.currentTimeMillis() - time
            while (isRunning) {
                time = System.currentTimeMillis() - startTime
                delay(10)
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("High-Precision Timer", fontSize = 18.sp, color = Color.Gray)
        val seconds = time / 1000
        val millis = (time % 1000) / 10
        Text(
            text = String.format(Locale.getDefault(), "%02d:%02d.%02d", seconds / 60, seconds % 60, millis),
            fontSize = 64.sp,
            fontWeight = FontWeight.Bold
        )
        
        Spacer(Modifier.height(32.dp))
        
        Row {
            Button(onClick = { isRunning = !isRunning }) {
                Text(if (isRunning) "Stop" else "Start")
            }
            Spacer(Modifier.width(16.dp))
            Button(onClick = { time = 0; isRunning = false }) {
                Text("Reset")
            }
        }
        
        Spacer(Modifier.height(32.dp))
        
                        if (!isRunning && time > 0) {
            Button(
                onClick = {
                    scope.launch {
                        dao.insertTrial(Trial(athleteId = athleteId, trialType = "100m Sprint", value = time / 1000.0))
                        onComplete()
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Save Record")
            }
        }
    }
}
