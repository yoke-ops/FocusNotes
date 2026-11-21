package com.focusnotes

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** 基类：四种尺寸共用同一套数据与刷新逻辑，只切换布局。 */
open class FocusNotesWidgetProvider : AppWidgetProvider() {
    companion object {
        private const val PREFS = "focusnotes.widget"
        private const val KEY_TODOS = "todos"
        private const val KEY_HABITS = "habits"
        private const val KEY_PREFS = "prefs"

        private val ALL_PROVIDERS = listOf(
            FocusNotesWidgetProvider::class.java,
            Widget1x1Provider::class.java,
            Widget1x2Provider::class.java,
            Widget2x2Provider::class.java,
        )

        fun updateTodos(context: Context, json: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_TODOS, json).apply()
            refreshAll(context)
        }

        fun updateHabits(context: Context, json: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_HABITS, json).apply()
            refreshAll(context)
        }

        fun updatePrefs(context: Context, json: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_PREFS, json).apply()
            refreshAll(context)
        }

        private fun layoutKindFor(clazz: Class<*>): String = when (clazz) {
            Widget1x1Provider::class.java -> "1x1"
            Widget1x2Provider::class.java -> "1x2"
            Widget2x2Provider::class.java -> "2x2"
            else -> "2x4"
        }

        fun refreshAll(context: Context) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val json = prefs.getString(KEY_TODOS, "[]") ?: "[]"
            val habits = prefs.getString(KEY_HABITS, "[]") ?: "[]"
            val prefsJson = prefs.getString(KEY_PREFS, "{}") ?: "{}"
            val manager = AppWidgetManager.getInstance(context)
            ALL_PROVIDERS.forEach { clazz ->
                val ids = manager.getAppWidgetIds(ComponentName(context, clazz))
                ids.forEach { updateWidget(context, manager, it, layoutKindFor(clazz), json, prefsJson, habits) }
            }
        }

        private fun colors(prefJson: String, context: Context): Triple<Boolean, Int, Int> {
            val pref = try { org.json.JSONObject(prefJson) } catch (_: Exception) { org.json.JSONObject() }
            val mode = pref.optString("darkMode", "system")
            val night = (context.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
            val dark = mode == "dark" || (mode == "system" && night)
            val textColor = if (dark) Color.parseColor("#f5f5f7") else Color.parseColor("#1d1d1f")
            val subColor = if (dark) Color.parseColor("#a1a1aa") else Color.parseColor("#6e6e73")
            return Triple(dark, textColor, subColor)
        }

        private fun scaleOf(prefJson: String): Float {
            val pref = try { org.json.JSONObject(prefJson) } catch (_: Exception) { org.json.JSONObject() }
            return (pref.optInt("fontSize", 100).toFloat() / 100f).coerceIn(0.8f, 1.4f)
        }

        private fun updateWidget(context: Context, manager: AppWidgetManager, id: Int, kind: String, json: String, prefJson: String = "{}", habitJson: String = "[]") {
            val (dark, textColor, subColor) = colors(prefJson, context)
            val scale = scaleOf(prefJson)
            val launch = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val todos = try { JSONArray(json) } catch (_: Exception) { JSONArray() }

            when (kind) {
                "1x1" -> {
                    val views = RemoteViews(context.packageName, R.layout.widget_1x1)
                    views.setInt(R.id.widget_root, "setBackgroundResource", if (dark) R.drawable.widget_background_dark else R.drawable.widget_background)
                    views.setTextViewText(R.id.widget_count, todos.length().toString())
                    views.setTextColor(R.id.widget_count, textColor)
                    views.setTextViewTextSize(R.id.widget_count, android.util.TypedValue.COMPLEX_UNIT_SP, 28f * scale)
                    views.setTextColor(R.id.widget_count_label, subColor)
                    views.setTextViewTextSize(R.id.widget_count_label, android.util.TypedValue.COMPLEX_UNIT_SP, 10f * scale)
                    views.setOnClickPendingIntent(R.id.widget_root, launch)
                    manager.updateAppWidget(id, views)
                }
                "1x2" -> {
                    val views = RemoteViews(context.packageName, R.layout.widget_1x2)
                    views.setInt(R.id.widget_root, "setBackgroundResource", if (dark) R.drawable.widget_background_dark else R.drawable.widget_background)
                    val first = if (todos.length() > 0) todos.getJSONObject(0) else null
                    views.setTextViewText(R.id.widget_row_title, first?.optString("title", "今天没有待办") ?: "今天没有待办")
                    views.setTextViewText(R.id.widget_row_due, if (first != null) formatDue(first.optString("dueAt")) else "保持从容")
                    views.setTextColor(R.id.widget_row_title, textColor)
                    views.setTextColor(R.id.widget_row_due, subColor)
                    views.setTextViewTextSize(R.id.widget_row_title, android.util.TypedValue.COMPLEX_UNIT_SP, 13f * scale)
                    views.setTextViewTextSize(R.id.widget_row_due, android.util.TypedValue.COMPLEX_UNIT_SP, 10f * scale)
                    views.setOnClickPendingIntent(R.id.widget_root, launch)
                    manager.updateAppWidget(id, views)
                }
                "2x2" -> {
                    val views = RemoteViews(context.packageName, R.layout.widget_2x2)
                    views.setInt(R.id.widget_root, "setBackgroundResource", if (dark) R.drawable.widget_background_dark else R.drawable.widget_background)
                    views.setTextColor(R.id.widget_square_heading, subColor)
                    views.setTextColor(R.id.widget_square_empty, subColor)
                    views.setTextViewTextSize(R.id.widget_square_heading, android.util.TypedValue.COMPLEX_UNIT_SP, 10f * scale)
                    views.setTextViewTextSize(R.id.widget_square_empty, android.util.TypedValue.COMPLEX_UNIT_SP, 11f * scale)
                    views.setViewVisibility(R.id.widget_square_empty, if (todos.length() == 0) View.VISIBLE else View.GONE)
                    val slots = listOf(R.id.widget_sq_1, R.id.widget_sq_2, R.id.widget_sq_3)
                    slots.forEach { views.setViewVisibility(it, View.GONE); views.setTextColor(it, textColor); views.setTextViewTextSize(it, android.util.TypedValue.COMPLEX_UNIT_SP, 12f * scale) }
                    for (index in 0 until minOf(todos.length(), 3)) {
                        val todo = todos.getJSONObject(index)
                        views.setViewVisibility(slots[index], View.VISIBLE)
                        views.setTextViewText(slots[index], "· ${todo.optString("title", "")}")
                    }
                    views.setOnClickPendingIntent(R.id.widget_root, launch)
                    manager.updateAppWidget(id, views)
                }
                else -> renderFull(context, manager, id, todos, habitJson, dark, textColor, subColor, scale, launch)
            }
        }

        private fun renderFull(context: Context, manager: AppWidgetManager, id: Int, todos: JSONArray, habitJson: String, dark: Boolean, textColor: Int, subColor: Int, scale: Float, launch: PendingIntent) {
            val views = RemoteViews(context.packageName, R.layout.widget_focusnotes)
            views.setInt(R.id.widget_root, "setBackgroundResource", if (dark) R.drawable.widget_background_dark else R.drawable.widget_background)
            views.setTextColor(R.id.widget_brand, textColor)
            views.setTextColor(R.id.widget_caption, subColor)
            views.setTextViewTextSize(R.id.widget_brand, android.util.TypedValue.COMPLEX_UNIT_SP, 18f * scale)
            views.setTextViewTextSize(R.id.widget_caption, android.util.TypedValue.COMPLEX_UNIT_SP, 11f * scale)
            views.setTextColor(R.id.widget_empty, subColor)
            views.setTextColor(R.id.widget_habit_heading, textColor)
            views.setTextColor(R.id.widget_habit_empty, subColor)
            views.setTextViewTextSize(R.id.widget_habit_heading, android.util.TypedValue.COMPLEX_UNIT_SP, 12f * scale)
            views.setTextViewTextSize(R.id.widget_habit_empty, android.util.TypedValue.COMPLEX_UNIT_SP, 11f * scale)
            listOf(R.id.widget_title_1, R.id.widget_title_2, R.id.widget_title_3).forEach { rid ->
                views.setTextColor(rid, textColor)
                views.setTextViewTextSize(rid, android.util.TypedValue.COMPLEX_UNIT_SP, 13f * scale)
            }
            listOf(R.id.widget_due_1, R.id.widget_due_2, R.id.widget_due_3).forEach { rid ->
                views.setTextColor(rid, subColor)
                views.setTextViewTextSize(rid, android.util.TypedValue.COMPLEX_UNIT_SP, 10f * scale)
            }
            listOf(R.id.widget_habit_name_1, R.id.widget_habit_name_2, R.id.widget_habit_name_3).forEach { rid ->
                views.setTextColor(rid, textColor)
                views.setTextViewTextSize(rid, android.util.TypedValue.COMPLEX_UNIT_SP, 12f * scale)
            }
            listOf(R.id.widget_habit_streak_1, R.id.widget_habit_streak_2, R.id.widget_habit_streak_3).forEach { rid ->
                views.setTextColor(rid, subColor)
                views.setTextViewTextSize(rid, android.util.TypedValue.COMPLEX_UNIT_SP, 10f * scale)
            }
            listOf(R.id.widget_habit_status_1, R.id.widget_habit_status_2, R.id.widget_habit_status_3).forEach { rid ->
                views.setTextViewTextSize(rid, android.util.TypedValue.COMPLEX_UNIT_SP, 10f * scale)
            }
            views.setOnClickPendingIntent(R.id.widget_root, launch)
            val titles = listOf(R.id.widget_title_1, R.id.widget_title_2, R.id.widget_title_3)
            val dues = listOf(R.id.widget_due_1, R.id.widget_due_2, R.id.widget_due_3)
            val dots = listOf(R.id.widget_dot_1, R.id.widget_dot_2, R.id.widget_dot_3)
            val rows = listOf(R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3)
            rows.forEach { views.setViewVisibility(it, View.GONE) }
            views.setViewVisibility(R.id.widget_empty, if (todos.length() == 0) View.VISIBLE else View.GONE)
            for (index in 0 until minOf(todos.length(), 3)) {
                val todo = todos.getJSONObject(index)
                views.setViewVisibility(rows[index], View.VISIBLE)
                views.setTextViewText(titles[index], todo.getString("title"))
                views.setTextViewText(dues[index], formatDue(todo.optString("dueAt")))
                views.setTextColor(dots[index], Color.parseColor(todo.optString("color", "#8e8d93")))
            }
            val habitRows = listOf(R.id.widget_habit_row_1, R.id.widget_habit_row_2, R.id.widget_habit_row_3)
            val habitNames = listOf(R.id.widget_habit_name_1, R.id.widget_habit_name_2, R.id.widget_habit_name_3)
            val habitStreaks = listOf(R.id.widget_habit_streak_1, R.id.widget_habit_streak_2, R.id.widget_habit_streak_3)
            val habitStatuses = listOf(R.id.widget_habit_status_1, R.id.widget_habit_status_2, R.id.widget_habit_status_3)
            val habits = try { JSONArray(habitJson) } catch (_: Exception) { JSONArray() }
            habitRows.forEach { views.setViewVisibility(it, View.GONE) }
            views.setViewVisibility(R.id.widget_habit_empty, if (habits.length() == 0) View.VISIBLE else View.GONE)
            for (index in 0 until minOf(habits.length(), 3)) {
                val habit = habits.getJSONObject(index)
                val color = try { Color.parseColor(habit.optString("color", "#30d158")) } catch (_: IllegalArgumentException) { Color.parseColor("#30d158") }
                val done = habit.optBoolean("done", false)
                val scheduled = habit.optBoolean("scheduled", true)
                views.setViewVisibility(habitRows[index], View.VISIBLE)
                views.setTextViewText(habitNames[index], "${habit.optString("emoji", "🌱")} ${habit.optString("name", "习惯")}")
                views.setTextViewText(habitStreaks[index], "连续 ${habit.optInt("streak", 0)} 天")
                views.setTextViewText(habitStatuses[index], when {
                    done -> "✓"
                    scheduled -> "·"
                    else -> "休"
                })
                views.setTextColor(habitStatuses[index], if (done) Color.parseColor("#30a46c") else if (scheduled) color else subColor)
            }
            manager.updateAppWidget(id, views)
        }

        private fun formatDue(iso: String): String {
            if (iso.isBlank()) return "无截止时间"
            return try {
                val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
                val date = parser.parse(iso) ?: Date()
                SimpleDateFormat("MM月dd日 HH:mm", Locale.CHINA).format(date)
            } catch (_: Exception) { "截止时间待确认" }
        }
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_TODOS, "[]") ?: "[]"
        val habits = prefs.getString(KEY_HABITS, "[]") ?: "[]"
        val appearance = prefs.getString(KEY_PREFS, "{}") ?: "{}"
        val kind = when (this) {
            is Widget1x1Provider -> "1x1"
            is Widget1x2Provider -> "1x2"
            is Widget2x2Provider -> "2x2"
            else -> "2x4"
        }
        ids.forEach { updateWidget(context, manager, it, kind, json, appearance, habits) }
    }

    /** 用户拖动改尺寸后按新尺寸重绘。 */
    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, newOptions: android.os.Bundle) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_TODOS, "[]") ?: "[]"
        val habits = prefs.getString(KEY_HABITS, "[]") ?: "[]"
        val appearance = prefs.getString(KEY_PREFS, "{}") ?: "{}"
        val kind = when (this) {
            is Widget1x1Provider -> "1x1"
            is Widget1x2Provider -> "1x2"
            is Widget2x2Provider -> "2x2"
            else -> "2x4"
        }
        updateWidget(context, manager, id, kind, json, appearance, habits)
    }
}

/** 1×1：只显示今日待办数量。 */
class Widget1x1Provider : FocusNotesWidgetProvider()

/** 2×1（横条）：标题 + 最近一条待办。 */
class Widget1x2Provider : FocusNotesWidgetProvider()

/** 2×2：最多 3 条待办。 */
class Widget2x2Provider : FocusNotesWidgetProvider()
