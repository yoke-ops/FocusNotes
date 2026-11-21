import { useState } from 'react'
import { ActivityIndicator, Modal, StyleSheet, TextInput as RNTextInput } from 'react-native'
import Slider from '@react-native-community/slider'
import {
  ThemedKeyboardAvoidingView as KeyboardAvoidingView,
  ThemedPressable as Pressable,
  ThemedSafeAreaView as SafeAreaView,
  ThemedScrollView as ScrollView,
  ThemedText as Text,
  ThemedTextInput as TextInput,
  ThemedView as View,
} from '../theme'
import { CalendarPlus, X } from 'lucide-react-native'
import type { TodoDraft, TodoItem, TodoList } from '@focusnotes/core'
import { DueField } from './DueField'

interface Props {
  todo?: TodoItem
  lists: TodoList[]
  defaultListId?: string
  defaultDueAt?: string | null
  defaultReminderMinutesBefore: number
  onClose(): void
  onSave(draft: TodoDraft): Promise<void>
  onAddToCalendar(title: string, notes: string, dueAt: string): Promise<boolean>
}

export function EditTodoModal({ todo, lists, defaultListId, defaultDueAt, defaultReminderMinutesBefore, onClose, onSave, onAddToCalendar }: Props) {
  const [title, setTitle] = useState(todo?.title ?? '')
  const [notes, setNotes] = useState(todo?.notes ?? '')
  const [dueAt, setDueAt] = useState<string | null>(todo?.dueAt ?? defaultDueAt ?? null)
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(
    todo?.reminderMinutesBefore === undefined ? defaultReminderMinutesBefore : todo.reminderMinutesBefore ?? 0,
  )
  const [important, setImportant] = useState(todo?.important ?? false)
  const [urgent, setUrgent] = useState(todo?.urgent ?? false)
  const [listId, setListId] = useState(todo?.listId ?? defaultListId ?? 'inbox')
  const [saving, setSaving] = useState(false)
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [customReminder, setCustomReminder] = useState('')
  const [error, setError] = useState('')

  async function save() {
    if (!title.trim()) { setError('请输入待办标题。'); return }
    setSaving(true)
    try { await onSave({ title, notes, dueAt, reminderMinutesBefore: dueAt ? reminderMinutesBefore : null, important, urgent, listId }); onClose() }
    catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败。') }
    finally { setSaving(false) }
  }

  async function addToCalendar() {
    if (!dueAt) return
    setCalendarBusy(true)
    try {
      await onAddToCalendar(title.trim() || 'FocusNotes 待办', notes, dueAt)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法打开系统日历。')
    } finally {
      setCalendarBusy(false)
    }
  }

  return <Modal animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe}>
        <View style={styles.header}><Pressable style={styles.close} onPress={onClose} accessibilityLabel="关闭"><X size={23} color="#1d1d1f" /></Pressable><Text style={styles.heading}>{todo ? '编辑待办' : '新建待办'}</Text><View style={styles.close} /></View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>标题</Text><TextInput autoFocus style={styles.input} value={title} onChangeText={setTitle} placeholder="要做什么？" placeholderTextColor="#8e8d93" />
          <Text style={styles.label}>备注</Text><TextInput style={[styles.input, styles.notes]} value={notes} onChangeText={setNotes} placeholder="补充一些细节（可选）" placeholderTextColor="#8e8d93" multiline />
          <Text style={styles.label}>截止时间</Text><DueField value={dueAt} onChange={setDueAt} />
          {dueAt && <Pressable style={styles.calendarButton} onPress={() => void addToCalendar()} disabled={calendarBusy}><CalendarPlus size={16} color="#0071e3" /><Text style={styles.calendarButtonText}>{calendarBusy ? '正在打开日历…' : '添加到系统日历'}</Text></Pressable>}
          <Text style={styles.label}>提前提醒{reminderMinutesBefore > 0 ? ` · ${reminderMinutesBefore} 分钟前` : ' · 关闭'}</Text>
          <Slider style={styles.reminderSlider} minimumValue={0} maximumValue={240} step={5}
            value={Math.min(240, reminderMinutesBefore)} onSlidingComplete={(value) => { setReminderMinutesBefore(Math.round(value)); setCustomReminder('') }}
            minimumTrackTintColor="#0071e3" maximumTrackTintColor="#d1d1d6" thumbTintColor="#0071e3" />
          <Text style={styles.reminderScale}><Text>关闭</Text><Text>240 分钟</Text></Text>
          <View style={styles.customReminderRow}>
            <RNTextInput style={styles.customReminderInput} keyboardType="number-pad" value={customReminder}
              placeholder="自定义分钟数（0–10080）" placeholderTextColor="#8e8d93"
              onChangeText={(text) => { setCustomReminder(text); const value = Number(text); if (text && Number.isFinite(value)) setReminderMinutesBefore(Math.max(0, Math.min(10080, Math.round(value)))) }} />
            {customReminder !== '' && <Pressable style={styles.customReminderClear} onPress={() => { setCustomReminder(''); setReminderMinutesBefore(defaultReminderMinutesBefore) }}><Text style={styles.customReminderClearText}>重置</Text></Pressable>}
          </View>
          <Text style={styles.label}>所属清单</Text><View style={styles.listOptions}>
            {lists.map((list) => <Pressable key={list.id} style={[styles.listOption, listId === list.id && styles.selectedListOption]} onPress={() => setListId(list.id)}>
              <View style={[styles.listDot, { backgroundColor: list.color }]} />
              <Text style={[styles.listOptionText, listId === list.id && styles.selectedListText]} numberOfLines={1}>{list.name}</Text>
            </Pressable>)}
          </View>
          <Text style={styles.label}>四象限</Text><View style={styles.priorities}>
            <Pressable style={[styles.chip, important && styles.important]} onPress={() => setImportant(!important)}><Text style={[styles.chipText, important && styles.importantText]}>重要</Text></Pressable>
            <Pressable style={[styles.chip, urgent && styles.urgent]} onPress={() => setUrgent(!urgent)}><Text style={[styles.chipText, urgent && styles.urgentText]}>紧急</Text></Pressable>
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={styles.save} onPress={() => void save()} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>保存待办</Text>}</Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d1d1d6' },
  heading: { color: '#1d1d1f', fontSize: 17, fontWeight: '600' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 22 },
  label: { marginTop: 16, marginBottom: 8, color: '#6e6e73', fontSize: 12, fontWeight: '500' },
  input: { minHeight: 48, paddingHorizontal: 14, color: '#1d1d1f', fontSize: 16, borderRadius: 10, backgroundColor: '#f5f5f7' },
  notes: { minHeight: 100, paddingTop: 13, textAlignVertical: 'top' },
  calendarButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#eef6ff' },
  calendarButtonText: { color: '#0071e3', fontSize: 13, fontWeight: '600' },
  reminderSlider: { width: '100%', height: 40, marginTop: 2 },
  reminderScale: { flexDirection: 'row', justifyContent: 'space-between', color: '#8e8d93', fontSize: 10 },
  customReminderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  customReminderInput: { flex: 1, minHeight: 40, paddingHorizontal: 12, color: '#1d1d1f', fontSize: 13, borderRadius: 9, backgroundColor: '#f5f5f7' },
  customReminderClear: { paddingHorizontal: 10, minHeight: 40, justifyContent: 'center' },
  customReminderClearText: { color: '#0071e3', fontSize: 12 },
  reminderOption: { minHeight: 35, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 18, backgroundColor: '#f5f5f7' },
  reminderOptionSelected: { backgroundColor: '#eaf3ff' },
  reminderText: { color: '#6e6e73', fontSize: 11 },
  reminderTextSelected: { color: '#0071e3', fontWeight: '600' },
  listOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  listOption: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderWidth: 1, borderColor: '#e5e5ea', borderRadius: 18 },
  selectedListOption: { borderColor: '#0071e3', backgroundColor: '#eef6ff' },
  listDot: { width: 7, height: 7, borderRadius: 4 },
  listOptionText: { maxWidth: 100, color: '#6e6e73', fontSize: 11 },
  selectedListText: { color: '#0071e3', fontWeight: '600' },
  priorities: { flexDirection: 'row', gap: 10 },
  chip: { minWidth: 88, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d1d1d6', borderRadius: 22 },
  chipText: { color: '#6e6e73', fontSize: 14 },
  important: { borderColor: '#ff9f0a', backgroundColor: '#fff5df' },
  importantText: { color: '#b25000' },
  urgent: { borderColor: '#ff6961', backgroundColor: '#fff0ef' },
  urgentText: { color: '#d70015' },
  error: { marginTop: 16, color: '#d70015', fontSize: 13 },
  save: { minHeight: 50, marginTop: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#0071e3' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
