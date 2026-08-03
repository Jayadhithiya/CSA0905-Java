import java.util.*;
public class HashMap {
    public static void main(String[] args) {
        java.util.HashMap<Integer, String> products = new java.util.HashMap<>();
        Scanner sc = new Scanner(System.in);
        int choice, id;
        String name;
        do {
            System.out.println("\n===== Product Inventory =====");
            System.out.println("1. Add Product");
            System.out.println("2. Search Product");
            System.out.println("3. Update Product");
            System.out.println("4. Delete Product");
            System.out.println("5. Display Products");
            System.out.println("6. Exit");
            System.out.print("Enter Choice: ");
            choice = sc.nextInt();
            switch (choice) {
                case 1:
                    System.out.print("Enter Product ID: ");
                    id = sc.nextInt();
                    sc.nextLine();
                    System.out.print("Enter Product Name: ");
                    name = sc.nextLine();
                    products.put(id, name);
                    System.out.println("Product Added Successfully");
                    break;
                case 2:
                    System.out.print("Enter Product ID: ");
                    id = sc.nextInt();
                    if (products.containsKey(id))
                        System.out.println("Product Name: " + products.get(id));
                    else
                        System.out.println("Product Not Found");
                    break;
                case 3:
                    System.out.print("Enter Product ID: ");
                    id = sc.nextInt();
                    sc.nextLine();
                    if (products.containsKey(id)) {
                        System.out.print("Enter New Product Name: ");
                        name = sc.nextLine();
                        products.put(id, name);
                        System.out.println("Product Updated Successfully");
                    } else {
                        System.out.println("Product Not Found");
                    }
                    break;
                case 4:
                    System.out.print("Enter Product ID: ");
                    id = sc.nextInt();
                    if (products.containsKey(id)) {
                        products.remove(id);
                        System.out.println("Product Deleted Successfully!");
                    } else {
                        System.out.println("Product Not Found");
                    }
                    break;
                case 5:
                    if (products.isEmpty()) {
                        System.out.println("No Products Available.");
                    } else {
                        System.out.println("\nProduct List:");
                        for (Map.Entry<Integer, String> entry : products.entrySet()) {
                            System.out.println("ID: " + entry.getKey() +
                                    "  Name: " + entry.getValue());
                        }
                    }
                    break;
                case 6:
                    System.out.println("Thank You");
                    break;
                default:
                    System.out.println("Invalid Choice");
            }
        } while (choice != 6);
        sc.close();
    }
}