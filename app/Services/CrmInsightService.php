<?php
declare(strict_types=1);

namespace App\Services;

use DateTimeImmutable;
use DateTimeZone;
use PDO;

final class CrmInsightService
{
    public function __construct(private readonly PDO $pdo) {}

    private static function score(?int $days, int $frequency, int $amount): array
    {
        // Sans commande livrée, aucun critère R/F/M ne peut recevoir de point.
        if ($frequency === 0 || $days === null) {
            return ['r' => 0, 'f' => 0, 'm' => 0, 'score' => 0, 'segment' => 'Sans achat'];
        }
        // Récence exprimée en mois : 365,25 jours / 12, sans arrondir
        // avant la classification. Barème de 1, 3 ou 5 points par critère.
        $months = $days / (365.25 / 12);
        $r = $months <= 2 ? 5 : ($months <= 7 ? 3 : 1);
        $f = $frequency > 5 ? 5 : ($frequency >= 2 ? 3 : 1);
        $m = $amount > 4000000 ? 5 : ($amount >= 2000000 ? 3 : 1);
        $sum = $r + $f + $m;
        return ['r' => $r, 'f' => $f, 'm' => $m, 'score' => $sum,
            'segment' => $sum >= 13 ? 'Très bon client' :
                ($sum >= 9 ? 'Bon client' : ($sum >= 5 ? 'Client occasionnel' : 'Nouveau client'))];
    }

    public function report(): array
    {
        $today = new DateTimeImmutable('today', new DateTimeZone('UTC'));
        $from = $today->modify('-364 days')->format('Y-m-d\T00:00:00\Z');
        $previousFrom = $today->modify('-729 days')->format('Y-m-d\T00:00:00\Z');
        $until = $today->modify('+1 day')->format('Y-m-d\T00:00:00\Z');

        $registered = (int)$this->pdo->query("SELECT COUNT(*) FROM users WHERE role='client'")->fetchColumn();
        $totals = $this->pdo->prepare("SELECT COUNT(*) AS orders, COALESCE(SUM(total_xaf),0) AS revenue,
            COUNT(DISTINCT user_id) AS buyers
            FROM orders WHERE status='delivered' AND created_at >= :start AND created_at < :end");
        $totals->execute(['start' => $from, 'end' => $until]);
        $tot = $totals->fetch(PDO::FETCH_ASSOC);
        $orders = (int)$tot['orders'];
        $revenue = (int)$tot['revenue'];
        $buyers = (int)$tot['buyers'];

        $query = $this->pdo->prepare("SELECT u.id, u.name, COUNT(o.id) AS frequency,
            COALESCE(SUM(o.total_xaf),0) AS amount, MAX(o.created_at) AS last_at,
            (SELECT COALESCE(SUM(lt.points_delta),0) FROM loyalty_transactions lt WHERE lt.user_id=u.id) AS loyalty_points
            FROM users u LEFT JOIN orders o ON o.user_id=u.id
                AND o.status='delivered' AND o.created_at >= :start AND o.created_at < :end
            WHERE u.role='client'
            GROUP BY u.id ORDER BY amount DESC, u.id LIMIT 1000");
        $query->execute(['start' => $from, 'end' => $until]);
        $customers = [];
        $segments = ['Très bon client'=>0, 'Bon client'=>0, 'Client occasionnel'=>0, 'Nouveau client'=>0, 'Sans achat'=>0];
        foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $days = $row['last_at'] === null ? null :
                max(0, (int)floor(($today->getTimestamp() - strtotime((string)$row['last_at'])) / 86400));
            $frequency = (int)$row['frequency'];
            $amount = (int)$row['amount'];
            $scoring = self::score($days, $frequency, $amount);
            $segments[$scoring['segment']]++;
            $customers[] = ['id'=>(int)$row['id'], 'name'=>$row['name'], 'days'=>$days,
                'months'=>$days === null ? null : round($days / (365.25 / 12), 1),
                'frequency'=>$frequency, 'amount'=>$amount, 'loyalty_points'=>(int)$row['loyalty_points']] + $scoring;
        }

        $old = $this->pdo->prepare("SELECT DISTINCT user_id FROM orders
            WHERE status='delivered' AND created_at >= :start AND created_at < :end");
        $old->execute(['start' => $previousFrom, 'end' => $from]);
        $previous = array_map('intval', $old->fetchAll(PDO::FETCH_COLUMN));
        $retention = null;
        if (count($previous) > 0) {
            $current = $this->pdo->prepare("SELECT DISTINCT user_id FROM orders
                WHERE status='delivered' AND created_at >= :start AND created_at < :end");
            $current->execute(['start'=>$from, 'end'=>$until]);
            $currentSet = array_fill_keys(array_map('intval', $current->fetchAll(PDO::FETCH_COLUMN)), true);
            $retention = round(100 * count(array_filter($previous, static fn(int $id): bool => isset($currentSet[$id]))) / count($previous), 2);
        }

        $startMonth = $today->modify('first day of this month')->modify('-11 months');
        $monthly = [];
        for ($i=0; $i<12; $i++) {
            $month = $startMonth->modify("+$i months")->format('Y-m');
            $monthly[$month] = ['month'=>$month, 'orders'=>0, 'revenue'=>0];
        }
        $sql = $this->pdo->prepare("SELECT substr(created_at,1,7) AS month,
            COUNT(*) AS orders, COALESCE(SUM(total_xaf),0) AS revenue
            FROM orders WHERE status='delivered' AND created_at >= :start AND created_at < :end
            GROUP BY substr(created_at,1,7)");
        $sql->execute(['start'=>$startMonth->format('Y-m-d\T00:00:00\Z'), 'end'=>$until]);
        foreach ($sql->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if (isset($monthly[$row['month']])) {
                $monthly[$row['month']] = ['month'=>$row['month'], 'orders'=>(int)$row['orders'], 'revenue'=>(int)$row['revenue']];
            }
        }

        $ticketCount = $this->pdo->query("SELECT COUNT(*) FROM tickets WHERE status IN ('open','in_progress')")->fetchColumn();
        $feedback = $this->pdo->query("SELECT COUNT(*) AS total, AVG(rating) AS average FROM feedback")->fetch(PDO::FETCH_ASSOC);
        return [
            'period'=>['from'=>substr($from,0,10), 'to'=>$today->format('Y-m-d')],
            'registered_customers'=>$registered, 'buyers'=>$buyers, 'orders'=>$orders, 'revenue'=>$revenue,
            'average_basket'=>$orders > 0 ? $revenue/$orders : null,
            'purchase_frequency'=>$buyers > 0 ? $orders/$buyers : null,
            'annual_value'=>$buyers > 0 ? $revenue/$buyers : null,
            'retention'=>$retention, 'pending_tickets'=>(int)$ticketCount,
            'feedback_count'=>(int)$feedback['total'],
            'satisfaction'=>$feedback['average'] === null ? null : (float)$feedback['average'],
            'monthly'=>array_values($monthly), 'rfm'=>$customers, 'segments'=>$segments,
            'rfm_limit'=>1000
        ];
    }
}
