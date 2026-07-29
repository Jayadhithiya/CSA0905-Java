import java.util.Scanner;

/**
 * To-Do List Application using a custom Singly Linked List.
 *
 * Features:
 *  1. Add a task
 *  2. View all tasks
 *  3. Search a task
 *  4. Delete a task
 *  5. Mark a task as completed
 *  6. Exit
 */
public class ToDoListLinkedList {

    // ---------- Node class ----------
    static class Node {
        String task;
        boolean completed;
        Node next;

        Node(String task) {
            this.task = task;
            this.completed = false;
            this.next = null;
        }
    }

    // ---------- Linked List class ----------
    static class TaskList {
        private Node head;
        private int size;

        // Add a task at the end of the list
        public void addTask(String task) {
            Node newNode = new Node(task);
            if (head == null) {
                head = newNode;
            } else {
                Node current = head;
                while (current.next != null) {
                    current = current.next;
                }
                current.next = newNode;
            }
            size++;
            System.out.println("✅ Task added: \"" + task + "\"");
        }

        // View all tasks
        public void viewTasks() {
            if (head == null) {
                System.out.println("📭 No tasks in the list.");
                return;
            }
            System.out.println("\n📋 Your To-Do List:");
            System.out.println("--------------------------------------------------");
            Node current = head;
            int index = 1;
            while (current != null) {
                String status = current.completed ? "✔️ Done" : "❌ Pending";
                System.out.printf("%d. [%s] %s%n", index, status, current.task);
                current = current.next;
                index++;
            }
            System.out.println("--------------------------------------------------");
            System.out.println("Total tasks: " + size);
        }

        // Search a task by keyword (case-insensitive substring match)
        public void searchTask(String keyword) {
            if (head == null) {
                System.out.println("📭 No tasks to search.");
                return;
            }
            Node current = head;
            int index = 1;
            boolean found = false;
            System.out.println("\n🔍 Search results for \"" + keyword + "\":");
            while (current != null) {
                if (current.task.toLowerCase().contains(keyword.toLowerCase())) {
                    String status = current.completed ? "✔️ Done" : "❌ Pending";
                    System.out.printf("%d. [%s] %s%n", index, status, current.task);
                    found = true;
                }
                current = current.next;
                index++;
            }
            if (!found) {
                System.out.println("No matching task found.");
            }
        }

        // Delete a task by its position (1-based index)
        public void deleteTask(int position) {
            if (head == null) {
                System.out.println("📭 No tasks to delete.");
                return;
            }
            if (position < 1 || position > size) {
                System.out.println("⚠️ Invalid task number.");
                return;
            }

            if (position == 1) {
                System.out.println("🗑️ Deleted task: \"" + head.task + "\"");
                head = head.next;
            } else {
                Node current = head;
                for (int i = 1; i < position - 1; i++) {
                    current = current.next;
                }
                Node toDelete = current.next;
                current.next = toDelete.next;
                System.out.println("🗑️ Deleted task: \"" + toDelete.task + "\"");
            }
            size--;
        }

        // Mark a task as completed by its position (1-based index)
        public void markCompleted(int position) {
            if (head == null) {
                System.out.println("📭 No tasks available.");
                return;
            }
            if (position < 1 || position > size) {
                System.out.println("⚠️ Invalid task number.");
                return;
            }

            Node current = head;
            for (int i = 1; i < position; i++) {
                current = current.next;
            }
            current.completed = true;
            System.out.println("✏️ Marked as completed: \"" + current.task + "\"");
        }
    }

    // ---------- Main program with menu ----------
    public static void main(String[] args) {
        TaskList taskList = new TaskList();
        Scanner scanner = new Scanner(System.in);
        boolean running = true;

        System.out.println("=====================================");
        System.out.println("   📝 TO-DO LIST (Linked List based)  ");
        System.out.println("=====================================");

        while (running) {
            printMenu();
            System.out.print("Choose an option: ");
            String choice = scanner.nextLine().trim();

            switch (choice) {
                case "1":
                    System.out.print("Enter task description: ");
                    String newTask = scanner.nextLine().trim();
                    if (newTask.isEmpty()) {
                        System.out.println("⚠️ Task cannot be empty.");
                    } else {
                        taskList.addTask(newTask);
                    }
                    break;

                case "2":
                    taskList.viewTasks();
                    break;

                case "3":
                    System.out.print("Enter keyword to search: ");
                    String keyword = scanner.nextLine().trim();
                    taskList.searchTask(keyword);
                    break;

                case "4":
                    taskList.viewTasks();
                    System.out.print("Enter task number to delete: ");
                    int delIndex = readInt(scanner);
                    if (delIndex != -1) {
                        taskList.deleteTask(delIndex);
                    }
                    break;

                case "5":
                    taskList.viewTasks();
                    System.out.print("Enter task number to mark as completed: ");
                    int doneIndex = readInt(scanner);
                    if (doneIndex != -1) {
                        taskList.markCompleted(doneIndex);
                    }
                    break;

                case "6":
                    running = false;
                    System.out.println("🚪 Exiting... Goodbye!");
                    break;

                default:
                    System.out.println("⚠️ Invalid option. Please choose 1-6.");
            }
            System.out.println();
        }

        scanner.close();
    }

    private static void printMenu() {
        System.out.println("--------- MENU ---------");
        System.out.println("1. ➕ Add a task");
        System.out.println("2. 📋 View all tasks");
        System.out.println("3. 🔍 Search a task");
        System.out.println("4. ❌ Delete a task");
        System.out.println("5. ✏️ Mark a task as completed");
        System.out.println("6. 🚪 Exit");
        System.out.println("-------------------------");
    }

    private static int readInt(Scanner scanner) {
        String input = scanner.nextLine().trim();
        try {
            return Integer.parseInt(input);
        } catch (NumberFormatException e) {
            System.out.println("⚠️ Please enter a valid number.");
            return -1;
        }
    }
}
