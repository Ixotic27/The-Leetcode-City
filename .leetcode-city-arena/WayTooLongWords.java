// LeetCode City Arena -- 71A. Way Too Long Words
import java.io.*;

public class WayTooLongWords {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String line = br.readLine();
        if (line == null) return;
        int n = Integer.parseInt(line.trim());
        for (int i = 0; i < n; i++) {
            String word = br.readLine();
            if (word == null) break;
            word = word.trim();
            if (word.length() > 10) {
                int len = word.length();
                System.out.println("" + word.charAt(0) + (len - 2) + word.charAt(len - 1));
            } else {
                System.out.println(word);
            }
        }
    }
}
